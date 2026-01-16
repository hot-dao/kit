import { Transaction } from "@stellar/stellar-base";

import HOT from "../hot-wallet/iframe";
import type { HotConnector } from "../HotConnector";

import { WalletType } from "../core/chains";
import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import { FreighterModule } from "./freigher";
import { HotWalletModule } from "./hotWallet";
import StellarWallet from "./wallet";

class StellarConnector extends OmniConnector<StellarWallet> {
  icon = "https://storage.herewallet.app/upload/1469894e53ca248ac6adceb2194e6950a13a52d972beb378a20bce7815ba01a4.png";
  walletTypes = [WalletType.STELLAR, WalletType.OMNI];
  type = ConnectorType.WALLET;
  name = "Stellar Wallet";
  id = "stellar";

  modules = {
    hotWallet: new HotWalletModule(),
    freighter: new FreighterModule(),
  };

  constructor(wibe3: HotConnector) {
    super(wibe3);

    this.options = Object.values(this.modules).map((module) => ({
      type: "external" as const,
      name: module.productName,
      icon: module.productIcon,
      download: module.productUrl,
      id: module.productId,
    }));

    this.getConnectedWallet().then(async ({ id, address }) => {
      if (!id || !address) return;
      const wallet = this.getWallet(id);
      const isAvailable = await wallet?.isAvailable();
      if (isAvailable && wallet) this.selectWallet(address, wallet);
    });
  }

  getWallet(id: string): FreighterModule | HotWalletModule | null {
    return Object.values(this.modules).find((module) => module.productId === id) || null;
  }

  async getConnectedWallet() {
    if (HOT.isInjected) {
      const { address } = await this.modules.hotWallet.getAddress();
      return { type: "wallet", id: this.modules.hotWallet.productId, address };
    }

    return await this.getStorage();
  }

  async selectWallet(address: string, wallet: HotWalletModule | FreighterModule) {
    const signMessage = async (message: string) => wallet.signMessage(message);
    const signTransaction = async (transaction: Transaction) => wallet.signTransaction(transaction.toXDR());
    const instance = new StellarWallet({ address, rpc: this.wibe3.exchange.bridge.stellar, signMessage, signTransaction });
    return this.setWallet(instance);
  }

  async connect(id: string) {
    const wallet = this.getWallet(id);
    if (!wallet) throw new Error("Wallet not found");

    const { address } = await wallet.getAddress();
    this.setStorage({ type: "wallet", id, address });
    return this.selectWallet(address, wallet);
  }

  async disconnect() {
    super.disconnect();
    this.removeStorage();
  }
}

export default StellarConnector;
