import type { HotKit } from "../HotKit";
import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import { WalletType } from "../core/chains";
import TronWallet from "./wallet";

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

class TronConnector extends OmniConnector<TronWallet> {
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

  async connect(id: string = TRONLINK.id) {
    if (id !== TRONLINK.id) throw new Error("Wallet not found");

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
