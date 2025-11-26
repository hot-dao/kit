import UniversalProvider from "@walletconnect/universal-provider";
import { Wallet } from "@wallet-standard/base";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { WalletType } from "../omni/config";

import { isInjected } from "../hot-wallet/hot";
import SolanaProtocolWallet from "./protocol";
import { getWallets } from "./wallets";
import SolanaWallet from "./wallet";

export interface SolanaConnectorOptions {
  projectId?: string;
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

const wallets = getWallets();

class SolanaConnector extends OmniConnector<SolanaWallet, { wallet: Wallet; name: string; icon: string; id: string }> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.SOLANA, WalletType.OMNI];
  name = "Solana Wallet";
  icon = "https://storage.herewallet.app/upload/8700f33153ad813e133e5bf9b791b5ecbeea66edca6b8d17aeccb8048eb29ef7.png";
  id = "solana";

  provider?: Promise<UniversalProvider>;

  constructor(options?: SolanaConnectorOptions) {
    super();

    wallets.get().forEach((t) => {
      if (this.options.find((w) => w.name === t.name)) return;
      this.options.push({ wallet: t, name: t.name, icon: t.icon, id: t.name });
    });

    this.getConnectedWallet().then(async ({ id }) => {
      try {
        const wallet = this.options.find((w) => w.id === id);
        if (!wallet) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: true });
        this.setWallet(new SolanaWallet(this, protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("register", async (wallet) => {
      if (this.options.find((w) => w.id === wallet.name)) return;
      runInAction(() => {
        this.options.push({ wallet: wallet, name: wallet.name, icon: wallet.icon, id: wallet.name });
      });

      try {
        const connected = await this.getConnectedWallet();
        if (connected !== wallet.name) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet, { silent: true });
        this.setWallet(new SolanaWallet(this, protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("unregister", (wallet) => {
      this.options = this.options.filter((w) => w.id !== wallet.name);
    });
  }

  async getConnectedWallet() {
    if (isInjected()) return { type: "wallet", id: "HOT Wallet" };
    return this.getStorage();
  }

  async connect(id: string) {
    const provider = await this.provider;
    if (provider?.session) await provider.disconnect();

    provider?.cleanupPendingPairings();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) return;

    try {
      this.setStorage({ type: "wallet", id });
      const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: false });
      this.setWallet(new SolanaWallet(this, protocolWallet));
    } catch (e) {
      this.removeStorage();
    }
  }

  async silentDisconnect() {
    this.removeStorage();
    const provider = await this.provider;
    provider?.disconnect();
  }
}

export default SolanaConnector;
