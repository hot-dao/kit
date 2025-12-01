import { TonConnectUI, TonConnect } from "@tonconnect/ui";
import { runInAction } from "mobx";

import { WalletType } from "../omni/config";
import { HotConnector } from "../HotConnector";
import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { isInjected } from "../hot-wallet/hot";
import TonWallet from "./wallet";

export interface TonConnectorOptions {
  tonConnect?: TonConnectUI;
  tonWalletsUrl?: string;
  tonManifestUrl?: string;
}

const hotWallet = {
  app_name: "hot",
  name: "HOT",
  image: "https://raw.githubusercontent.com/hot-dao/media/main/logo.png",
  about_url: "https://hot-labs.org/",
  universal_url: "https://t.me/herewalletbot?attach=wallet",
  bridge: [
    {
      type: "sse",
      url: "https://sse-bridge.hot-labs.org",
    },
    {
      type: "js",
      key: "hotWallet",
    },
  ],
  platforms: ["ios", "android", "chrome", "firefox", "macos", "windows", "linux"],
  features: [
    {
      name: "SendTransaction",
      maxMessages: 4,
      extraCurrencySupported: false,
    },
  ],
};

class TonConnector extends OmniConnector<TonWallet> {
  private tonConnect!: TonConnectUI;

  type = ConnectorType.WALLET;
  walletTypes = [WalletType.TON, WalletType.OMNI];
  icon = "https://storage.herewallet.app/upload/3ffa61e237f8e38d390abd60200db8edff3ec2b20aad0cc0a8c7a8ba9c318124.png";
  name = "TON Wallet";
  id = "ton";

  constructor(wibe3: HotConnector, readonly args?: TonConnectorOptions) {
    super(wibe3);
    if (typeof window !== "undefined") {
      this.initializeConnector();
    }
  }

  async initializeConnector() {
    const url = await fetch(this.args?.tonWalletsUrl || "https://config.ton.org/wallets-v2.json")
      .then((res) => res.json())
      .then((data) => {
        const list = data.filter((t: any) => t.app_name !== "hot");
        list.unshift(hotWallet);
        const myBlob = new Blob([JSON.stringify(list)], { type: "text/plain" });
        return URL.createObjectURL(myBlob);
      });

    this.tonConnect =
      this.args?.tonConnect ||
      new TonConnectUI({
        connector: new TonConnect({
          walletsListSource: url,
          manifestUrl: this.args?.tonManifestUrl,
        }),
      });

    this.tonConnect.onStatusChange(async (wallet) => {
      if (!wallet) return this.removeWallet();
      this.setWallet(
        new TonWallet(this, {
          sendTransaction: (params) => this.tonConnect.sendTransaction(params),
          signData: (params) => this.tonConnect.signData(params),
          account: wallet.account,
        })
      );
    });

    this.tonConnect.connector.restoreConnection();
    this.tonConnect.getWallets().then((wallets) => {
      runInAction(() => (this.options = wallets.map((w) => ({ name: w.name, icon: w.imageUrl, id: w.appName, download: w.aboutUrl }))));
    });

    const tcRoot = document.querySelector("#tc-widget-root");
    if (tcRoot instanceof HTMLElement) {
      tcRoot.style.zIndex = "10000000000";
      tcRoot.style.position = "fixed";
    }

    if (isInjected()) {
      this.tonConnect.getWallets().then((wallets) => {
        const wallet = wallets.find((w) => w.appName === "hot");
        if (wallet) this.tonConnect.connector.connect(wallet, { tonProof: "wibe3" });
      });
    }
  }

  async createWallet(address: string) {
    return new TonWallet(this, { account: { address } });
  }

  async connect(id: string) {
    const wallets = await this.tonConnect.getWallets();
    const wallet = wallets.find((w) => w.appName === id);
    if (!wallet) throw new Error("Wallet not found");
    this.tonConnect.openSingleWalletModal(id);

    return new Promise<TonWallet>((resolve, reject) => {
      const handleConnect = ({ wallet }: { wallet: TonWallet }) => {
        if (!wallet) return;
        resolve(wallet);
      };

      this.events.on("connect", handleConnect);
      const disposeModalStateChange = this.tonConnect.onSingleWalletModalStateChange((state) => {
        if (state.status === "closed") {
          reject(new Error("User closed the modal"));
          this.events.off("connect", handleConnect);
          disposeModalStateChange();
        }
      });
    });
  }

  async disconnect() {
    super.disconnect();
    this.tonConnect.disconnect();
  }
}

export default TonConnector;
