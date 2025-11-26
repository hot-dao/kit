import { sep43Modules, HotWalletModule, StellarWalletsKit, WalletNetwork, ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { Transaction } from "@stellar/stellar-base";

import { WalletType } from "../omni/config";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { isInjected } from "../hot-wallet/hot";
import StellarWallet from "./wallet";

type StellarOption = ISupportedWallet & { name: string; icon: string; uuid: string; rdns: string };
class StellarConnector extends OmniConnector<StellarWallet, StellarOption> {
  stellarKit: StellarWalletsKit;

  icon = "https://storage.herewallet.app/upload/1469894e53ca248ac6adceb2194e6950a13a52d972beb378a20bce7815ba01a4.png";
  walletTypes = [WalletType.STELLAR, WalletType.OMNI];
  type = ConnectorType.WALLET;
  name = "Stellar Wallet";
  id = "stellar";

  constructor(stellarKit?: StellarWalletsKit) {
    super();

    this.stellarKit = stellarKit || new StellarWalletsKit({ network: WalletNetwork.PUBLIC, modules: isInjected() ? [new HotWalletModule()] : sep43Modules() });
    this.stellarKit.getSupportedWallets().then((wallets) => {
      const hot = wallets.find((w) => w.id === "hot-wallet");
      this.options = wallets.filter((w) => w.id !== "hot-wallet").map((w) => ({ ...w, name: w.name, icon: w.icon, uuid: w.id, rdns: w.name }));
      if (hot) this.options.unshift({ ...hot, name: hot.name, icon: hot.icon, uuid: hot.id, rdns: hot.name });
    });

    this.getConnectedWallet().then((data) => {
      if (!data || !this.stellarKit) throw "No wallet";

      this.stellarKit.setWallet(data.id!);
      const signMessage = async (message: string) => this.stellarKit.signMessage(message);
      const signTransaction = async (transaction: Transaction) => this.stellarKit.signTransaction(transaction.toXDR());
      this.setWallet(new StellarWallet(this, { address: data.address!, signMessage, signTransaction }));
    });
  }

  async getConnectedWallet() {
    if (isInjected()) {
      this.stellarKit.setWallet("hot-wallet");
      const { address } = await this.stellarKit?.getAddress();
      return { type: "wallet", id: "hot-wallet", address };
    }

    return await this.getStorage();
  }

  async connect(id: string) {
    this.stellarKit.setWallet(id);
    const { address } = await this.stellarKit?.getAddress();
    const signMessage = async (message: string) => this.stellarKit.signMessage(message);
    const signTransaction = async (transaction: Transaction) => this.stellarKit.signTransaction(transaction.toXDR());
    this.setWallet(new StellarWallet(this, { address, signMessage, signTransaction }));
    this.setStorage({ type: "wallet", id, address });
  }

  async silentDisconnect() {
    this.removeStorage();
    this.stellarKit.disconnect();
  }
}

export default StellarConnector;
