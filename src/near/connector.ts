import { NearConnector } from "@hot-labs/near-connect";
import { runInAction } from "mobx";

import { WalletType } from "../omni/OmniWallet";
import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import NearWallet from "./wallet";

export interface NearConnectorOptions {
  connector?: NearConnector;
  projectId?: string;
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

class Connector extends OmniConnector<NearWallet> {
  connector: NearConnector;
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.NEAR, WalletType.OMNI];
  icon = "https://storage.herewallet.app/upload/73a44e583769f11112b0eff1f2dd2a560c05eed5f6d92f0c03484fa047c31668.png";
  name = "NEAR Wallet";
  id = "near";

  constructor(options?: NearConnectorOptions) {
    super();

    this.connector =
      options?.connector ||
      new NearConnector({
        network: "mainnet",
        walletConnect: options?.projectId ? { projectId: options.projectId, metadata: options.metadata } : undefined,
      });

    this.connector.on("wallet:signOut", () => this.removeWallet());
    this.connector.on("wallet:signIn", async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
    });

    this.connector.getConnectedWallet().then(async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
    });

    this.connector.whenManifestLoaded.then(() => {
      runInAction(() => {
        this.options = this.connector.wallets.map((w) => ({
          name: w.manifest.name,
          icon: w.manifest.icon,
          id: w.manifest.id,
        }));
      });
    });
  }

  async connect(id: string) {
    await this.connector.connect(id);
  }

  async silentDisconnect() {
    this.removeStorage();
    this.connector.disconnect();
  }
}

export default Connector;
