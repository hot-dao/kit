import { NearConnector } from "@hot-labs/near-connect";
import { runInAction } from "mobx";

import type { HotConnector } from "../HotConnector";
import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import { WalletType } from "../core/chains";
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

    if (connector) this.connector = connector;
    else {
      this.connector = new NearConnector({
        walletConnect: this.initWalletConnect().then((t) => t.client),
        network: "mainnet",
      });
    }

    this.connector.on("wallet:signOut", () => this.removeWallet());
    this.connector.on("wallet:signIn", async ({ wallet, accounts }) => {
      if (accounts.length === 0) return;
      const { accountId, publicKey } = accounts[0];
      this.setWallet(new NearWallet(accountId, publicKey, wallet));
    });

    this.connector.getConnectedWallet().then(async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(account.accountId, account.publicKey, wallet));
    });

    this.connector.whenManifestLoaded.then(() => {
      runInAction(() => {
        this.options = this.connector.wallets.map((w) => ({
          type: "external" as const,
          download: w.manifest.website,
          name: w.manifest.name,
          icon: w.manifest.icon,
          id: w.manifest.id,
        }));
      });
    });
  }

  async connect(id: string) {
    const wallet = await this.connector.connect(id);
    if (!wallet) throw new Error("Wallet not found");
    const [account] = await wallet.getAccounts();
    if (!account) throw new Error("No account found");
    return this.setWallet(new NearWallet(account.accountId, account.publicKey, wallet));
  }

  async disconnect() {
    super.disconnect();
    this.connector.disconnect();
  }
}

export default Connector;
