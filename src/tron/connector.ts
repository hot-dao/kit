import type { HotKit } from "../HotKit";
import { ConnectorType, OmniConnector, WC_ICON } from "../core/OmniConnector";
import { WalletType } from "../core/chains";
import TronWallet from "./wallet";
import TronWalletConnect from "./walletconnect";

declare global {
  interface Window {
    tronLink?: {
      ready?: boolean;
      request?: (args: { method: string; params?: any }) => Promise<any>;
      tronWeb?: {
        defaultAddress?: { base58?: string; hex?: string };
        address?: { toHex?: (address: string) => string };
        contract?: () => { at: (address: string) => Promise<any> };
        trx?: {
          getBalance?: (address: string) => Promise<number | string>;
          sendTransaction?: (to: string, amount: number | string) => Promise<any>;
          signMessageV2?: (message: string) => Promise<string>;
          signMessage?: (message: string) => Promise<string>;
        };
      };
    };
  }
}

const TRONLINK = {
  id: "tronlink",
  name: "Tron Link",
  type: "extension" as const,
  icon: "https://cdn.brandfetch.io/id0PcTcDBs/w/400/h/400/theme/dark/icon.jpeg",
  download: "https://www.tronlink.org/",
};

type TronConnectorWallet = TronWallet | TronWalletConnect;

class TronConnector extends OmniConnector<TronConnectorWallet> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.Tron, WalletType.OMNI];
  icon = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png";
  name = "TRON Wallet";
  id = "tron";

  constructor(kit: HotKit) {
    super(kit);
    this.options = [TRONLINK];

    this.syncFromProvider().catch(() => this.removeStorage());
    window.addEventListener("message", () => {
      this.syncFromProvider().catch(() => {});
    });

    this.initWalletConnect()
      .then(async () => {
        const wc = await this.wc;
        wc?.on?.("session_event", async (e: any) => {
          if (e?.params?.event?.name !== "accountsChanged") return;
          const data = e?.params?.event?.data;
          const first = Array.isArray(data) ? data[0] : data;
          const raw = typeof first === "string" ? first : "";
          const parts = raw.split(":");
          const address = parts.length >= 3 ? parts[2] : raw;
          const chainId = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : "tron:0x2b6653dc";
          if (!address) return;

          const stored = await this.getStorage().catch(() => ({} as any));
          if (stored?.type !== "walletconnect") return;

          const current = this.wallets[0]?.address;
          if (current === address) return;

          this.removeAllWallets();
          await this.setStorage({ type: "walletconnect", chainId });
          this.setWallet({ wallet: new TronWalletConnect(this, address, chainId), isNew: false });
        });

        this.options.unshift({
          id: "walletconnect",
          name: "WalletConnect",
          type: "external",
          icon: WC_ICON,
          download: "https://www.walletconnect.com/get",
        });

        const stored = await this.getStorage().catch(() => ({} as any));
        if (stored?.type !== "walletconnect") return;
        await this.setupWalletConnect();
      })
      .catch(() => {});
  }

  private async syncFromProvider() {
    const stored = (await this.getStorage().catch(() => ({} as any))) as { type?: string; id?: string; address?: string };
    if (stored.type !== "wallet" || stored.id !== TRONLINK.id) return;

    const tronWeb = window?.tronLink?.tronWeb;
    const address = tronWeb?.defaultAddress?.base58;
    if (!window?.tronLink?.ready || !address) return;

    const current = this.wallets[0]?.address;
    if (current === address) return;

    if (this.wallets.length > 0) this.removeWallet();
    await this.setStorage({ type: "wallet", id: TRONLINK.id, address });
    this.setWallet({ wallet: new TronWallet(this, address, tronWeb as any), isNew: false });
  }

  private async setupWalletConnect(): Promise<TronWalletConnect> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const account = wc.session?.namespaces.tron?.accounts[0];
    const parts = account?.split(":");
    const address = parts?.[2];
    const chainId = parts?.[0] && parts?.[1] ? `${parts[0]}:${parts[1]}` : "tron:0x2b6653dc";
    if (!address) throw new Error("Account not found");

    this.removeAllWallets();
    await this.setStorage({ type: "walletconnect", chainId });
    const wallet = new TronWalletConnect(this, address, chainId);
    this.setWallet({ wallet, isNew: false });
    return wallet;
  }

  async connect(id: string = TRONLINK.id) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          tron: {
            methods: ["tron_signMessage", "tron_signTransaction"],
            chains: ["tron:0x2b6653dc"],
            events: ["accountsChanged"],
          },
        },
      });
    }

    if (id !== TRONLINK.id) throw new Error("Wallet not found");
    this.disconnectWalletConnect();

    try {
      if (this.wallets.length > 0) this.removeWallet();

      const res = await window?.tronLink?.request?.({ method: "tron_requestAccounts" });
      if (res?.code !== 200) throw new Error("Failed to connect to TronLink");
      if (!window?.tronLink?.tronWeb) throw new Error("TronLink not found");

      const address = window?.tronLink?.tronWeb?.defaultAddress?.base58;
      if (!address) throw new Error("No account found");

      await this.setStorage({ type: "wallet", id: TRONLINK.id, address });
      return this.setWallet({ wallet: new TronWallet(this, address, window.tronLink.tronWeb), isNew: true });
    } catch (e) {
      await this.removeStorage();
      throw e;
    }
  }
}

export default TronConnector;
