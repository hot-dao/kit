import { TonConnectUI, TonConnect, Feature } from "@tonconnect/ui";
import { runInAction } from "mobx";

import type { HotConnector } from "../HotConnector";
import HOT from "../hot-wallet/iframe";

import { WalletType } from "../core/chains";
import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import TonWallet from "./wallet";

export interface TonConnectorOptions {
  tonConnect?: TonConnectUI;
  tonWalletsUrl?: string;
  tonManifestUrl?: string;
}

const hotWallet = {
  name: "HOT",
  app_name: "hot",
  image: "https://raw.githubusercontent.com/hot-dao/media/main/logo.png",
  about_url: "https://hot-labs.org/",
  universal_url: "https://app.hot-labs.org/link",
  bridge: [
    { type: "sse", url: "https://sse-bridge.hot-labs.org" },
    { type: "js", key: "hotWallet" },
  ],
  platforms: ["ios", "android", "chrome", "firefox", "macos", "windows", "linux"],
  features: [
    { name: "SendTransaction", maxMessages: 4, extraCurrencySupported: false },
    { name: "SignData", types: ["text", "binary", "cell"] },
  ],
};

const isSignDataFeature = (feature: Feature) => typeof feature === "object" && feature.name === "SignData" && feature.types.includes("text");

class TonConnector extends OmniConnector<TonWallet> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.TON, WalletType.OMNI];
  icon = "https://storage.herewallet.app/upload/3ffa61e237f8e38d390abd60200db8edff3ec2b20aad0cc0a8c7a8ba9c318124.png";
  name = "TON Wallet";
  id = "ton";

  private tonConnect = this.initializeConnector();
  constructor(wibe3: HotConnector, readonly args?: TonConnectorOptions) {
    super(wibe3);
  }

  async initializeConnector() {
    if (typeof window === "undefined") throw "TonConnector can only be initialized in the browser";

    const url = await fetch(this.args?.tonWalletsUrl || "https://config.ton.org/wallets-v2.json")
      .then((res) => res.json())
      .then((data) => {
        const list = data.filter((t: any) => t.app_name !== "hot");
        list.unshift(hotWallet);
        const myBlob = new Blob([JSON.stringify(list)], { type: "text/plain" });
        return URL.createObjectURL(myBlob);
      });

    const tonConnect =
      this.args?.tonConnect ||
      new TonConnectUI({
        connector: new TonConnect({
          walletsListSource: url,
          manifestUrl: this.args?.tonManifestUrl,
          walletsRequiredFeatures: { signData: { types: ["text"] } },
        }),
      });

    tonConnect.onStatusChange(async (wallet) => {
      if (!wallet) return this.removeWallet();
      this.setWallet(
        new TonWallet({
          sendTransaction: (params) => tonConnect.sendTransaction(params),
          signData: (params) => tonConnect.signData(params),
          account: wallet.account,
        })
      );
    });

    tonConnect.connector.restoreConnection();
    tonConnect.getWallets().then((wallets) => {
      runInAction(() => {
        this.options = wallets
          .filter((t) => t.features?.some(isSignDataFeature))
          .map((w) => ({
            name: w.name,
            icon: w.imageUrl,
            id: w.appName,
            download: w.aboutUrl,
            type: "external" as const,
          }));
      });
    });

    const tcRoot = document.querySelector("#tc-widget-root");
    if (tcRoot instanceof HTMLElement) {
      tcRoot.style.zIndex = "10000000000";
      tcRoot.style.position = "fixed";
    }

    if (HOT.isInjected) {
      tonConnect.getWallets().then((wallets) => {
        const wallet = wallets.find((w) => w.appName === "hot");
        if (wallet) tonConnect.connector.connect(wallet, { tonProof: "wibe3" });
      });
    }

    return tonConnect;
  }

  async connect(id: string) {
    const connector = await this.tonConnect;
    connector.openSingleWalletModal(id);
    return new Promise<TonWallet>((resolve) => {
      const dispose = this.onConnect(({ wallet }) => {
        if (!wallet) return;
        resolve(wallet);
        dispose();
      });
    });
  }

  async disconnect() {
    super.disconnect();
    const connector = await this.tonConnect;
    connector.disconnect();
  }
}

export default TonConnector;
