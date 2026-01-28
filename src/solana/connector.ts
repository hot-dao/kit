import { Wallet } from "@wallet-standard/base";
import { Transaction, PublicKey, VersionedTransaction, Connection } from "@solana/web3.js";
import { base58 } from "@scure/base";
import { runInAction } from "mobx";

import type { HotConnector } from "../HotConnector";

import { ConnectorType, OmniConnector, WC_ICON } from "../core/OmniConnector";
import { WalletType } from "../core/chains";
import HOT from "../hot-wallet/iframe";

import SolanaProtocolWallet from "./WalletStandard";
import { getWallets } from "./walletStandartList";
import SolanaWallet from "./wallet";

const wallets = getWallets();

class SolanaConnector extends OmniConnector<SolanaWallet, { wallet: Wallet }> {
  walletTypes = [WalletType.SOLANA, WalletType.OMNI];
  type = ConnectorType.WALLET;

  icon = "https://storage.herewallet.app/upload/8700f33153ad813e133e5bf9b791b5ecbeea66edca6b8d17aeccb8048eb29ef7.png";
  name = "Solana Wallet";
  id = "solana";

  constructor(wibe3: HotConnector) {
    super(wibe3);

    wallets.get().forEach((t) => {
      if (this.options.find((w) => w.name === t.name)) return;
      this.options.push({ type: "extension", wallet: t, name: t.name, icon: t.icon, id: t.name, download: t.url });
    });

    this.getConnectedWallet().then(async ({ id }) => {
      try {
        const wallet = this.options.find((w) => w.id === id);
        if (!wallet) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: true });
        this.setWallet(new SolanaWallet(protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("register", async (wallet: Wallet & { url?: string }) => {
      if (this.options.find((w) => w.id === wallet.name)) return;
      runInAction(() => {
        this.options.push({
          wallet: wallet,
          name: wallet.name,
          icon: wallet.icon,
          id: wallet.name,
          download: wallet.url,
          type: "extension",
        });
      });

      try {
        const connected = await this.getConnectedWallet();
        if (connected.id !== wallet.name) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet, { silent: true });
        this.setWallet(new SolanaWallet(protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("unregister", (wallet) => {
      this.options = this.options.filter((w) => w.id !== wallet.name);
    });

    this.initWalletConnect()
      .then(async () => {
        this.options.unshift({
          type: "external",
          download: "https://www.walletconnect.com/get",
          wallet: {} as Wallet,
          name: "WalletConnect",
          id: "walletconnect",
          icon: WC_ICON,
        });

        const selected = await this.getConnectedWallet();
        if (selected.type !== "walletconnect") return;
        this.setupWalletConnect();
      })
      .catch(() => {});
  }

  async setupWalletConnect(): Promise<SolanaWallet> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const account = wc.session?.namespaces.solana?.accounts[0]?.split(":")[2];
    if (!account) throw new Error("Account not found");

    this.setStorage({ type: "walletconnect" });
    return this.setWallet(
      new SolanaWallet({
        address: account,
        disconnect: () => this.disconnectWalletConnect(),
        sendTransaction: async (tx: Transaction | VersionedTransaction, connection: Connection, options?: any) => {
          const transaction = Buffer.from(tx.serialize()).toString("base64");
          const { signature } = await this.requestWalletConnect<{ signature: string }>({
            request: { params: { transaction, options }, method: "solana_signTransaction" },
          });
          tx.addSignature(new PublicKey(account), Buffer.from(base58.decode(signature)));
          return await connection.sendRawTransaction(tx.serialize(), options);
        },

        signMessage: async (msg: string) => {
          const message = base58.encode(Buffer.from(msg, "utf8"));
          const { signature } = await this.requestWalletConnect<{ signature: string }>({
            request: { method: "solana_signMessage", params: { message, pubkey: account } },
          });
          return base58.decode(signature);
        },
      })
    );
  }

  async disconnect() {
    this.wallets.forEach((w) => w.wallet.disconnect?.());
    super.disconnect();
  }

  async getConnectedWallet() {
    if (HOT.isInjected) return { type: "wallet", id: "HOT Wallet" };
    return this.getStorage();
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          solana: {
            methods: ["solana_signTransaction", "solana_signMessage"],
            chains: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"],
            events: [],
          },
        },
      });
    }

    this.disconnectWalletConnect();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) throw new Error("Wallet not found");

    try {
      this.setStorage({ type: "wallet", id });
      const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: false });
      return this.setWallet(new SolanaWallet(protocolWallet));
    } catch (e) {
      this.removeStorage();
      throw e;
    }
  }
}

export default SolanaConnector;
