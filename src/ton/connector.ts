import { TonConnectUI, TonConnect } from "@tonconnect/ui";
import { runInAction } from "mobx";

import { WalletType } from "../omni/OmniWallet";
import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { isInjected } from "../hot-wallet/hot";
import TonWallet from "./wallet";

export interface TonConnectorOptions {
  tonConnect?: TonConnectUI;
  tonWalletsUrl?: string;
  tonManifestUrl?: string;
}
class TonConnector extends OmniConnector<TonWallet> {
  private tonConnect!: TonConnectUI;

  type = ConnectorType.WALLET;
  walletTypes = [WalletType.TON, WalletType.OMNI];
  icon = "https://storage.herewallet.app/upload/3ffa61e237f8e38d390abd60200db8edff3ec2b20aad0cc0a8c7a8ba9c318124.png";
  name = "TON Wallet";
  id = "ton";

  constructor(args?: TonConnectorOptions) {
    super();

    if (typeof window !== "undefined") {
      this.tonConnect =
        args?.tonConnect ||
        new TonConnectUI({
          connector: new TonConnect({
            walletsListSource: args?.tonWalletsUrl,
            manifestUrl: args?.tonManifestUrl,
          }),
        });

      this.tonConnect.onStatusChange(async (wallet) => {
        if (!wallet) return this.removeWallet();
        this.setWallet(
          new TonWallet(this, {
            sendTransaction: (params: any) => this.tonConnect.sendTransaction(params),
            signData: (params: any) => this.tonConnect.signData(params),
            account: wallet.account,
          })
        );
      });

      this.tonConnect.connector.restoreConnection();
      this.tonConnect.getWallets().then((wallets) => {
        runInAction(() => (this.options = wallets.map((w) => ({ name: w.name, icon: w.imageUrl, id: w.appName }))));
      });

      if (isInjected()) {
        this.tonConnect.getWallets().then((wallets) => {
          const wallet = wallets.find((w) => w.appName === "hot");
          if (wallet) this.tonConnect.connector.connect(wallet, { tonProof: "wibe3" });
        });
      }
    }
  }

  async connect(id: string) {
    const wallets = await this.tonConnect.getWallets();
    const wallet = wallets.find((w) => w.appName === id);
    if (wallet) this.tonConnect.openSingleWalletModal(id);
  }

  async silentDisconnect() {
    this.tonConnect.disconnect();
    this.removeStorage();
  }
}

export default TonConnector;
