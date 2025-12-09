import { NearConnector } from "@hot-labs/near-connect";
import { runInAction } from "mobx";

import { WalletType } from "../core/chains";
import { ConnectorType, OmniConnector } from "../OmniConnector";
import { HotConnector } from "../HotConnector";
import NearWallet from "./wallet";

class Connector extends OmniConnector<NearWallet> {
  connector: NearConnector;
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.NEAR, WalletType.OMNI];
  icon = "https://storage.herewallet.app/upload/73a44e583769f11112b0eff1f2dd2a560c05eed5f6d92f0c03484fa047c31668.png";
  name = "NEAR Wallet";
  id = "near";

  constructor(readonly wibe3: HotConnector, connector?: NearConnector) {
    super(wibe3);

    this.connector =
      connector ||
      new NearConnector({
        network: "mainnet",
        walletConnect: this.wibe3.settings?.projectId ? { projectId: this.wibe3.settings.projectId, metadata: this.wibe3.settings.metadata } : undefined,
      });

    this.connector.on("wallet:signOut", () => this.removeWallet());
    this.connector.getConnectedWallet().then(async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
    });

    this.connector.whenManifestLoaded.then(() => {
      runInAction(() => {
        this.options = this.connector.wallets.map((w) => ({
          download: w.manifest.website,
          name: w.manifest.name,
          icon: w.manifest.icon,
          id: w.manifest.id,
          type: "external" as const,
        }));
      });
    });
  }

  async connect(id: string) {
    const wallet = await this.connector.connect(id);
    if (!wallet) throw new Error("Wallet not found");
    const [account] = await wallet.getAccounts();
    if (!account) throw new Error("No account found");
    return this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
  }

  async disconnect() {
    super.disconnect();
    this.connector.disconnect();
  }
}

export default Connector;
