import { NearConnector } from "@hot-labs/near-connect";
import { runInAction } from "mobx";

import type { HotKit } from "../HotKit";
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

  constructor(readonly kit: HotKit, connector?: NearConnector) {
    super(kit);

    if (connector) this.connector = connector;
    else {
      this.connector = new NearConnector({
        walletConnect: this.initWalletConnect().then((t) => t.client),
        network: "mainnet",
      });
    }

    this.connector.getConnectedWallet().then(async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (!account) return;
      if (this.wallets.find((t) => t.address === account.accountId)) return;
      this.setWallet({ wallet: new NearWallet(account.accountId, account.publicKey, wallet), isNew: false });
    });

    this.connector.on("wallet:signOut", () => this.removeWallet());
    this.connector.on("wallet:signIn", async ({ wallet, accounts }) => {
      if (accounts.length === 0) return;
      const { accountId, publicKey } = accounts[0];
      if (this.wallets.find((t) => t.address === accountId)) return;
      this.setWallet({ wallet: new NearWallet(accountId, publicKey, wallet), isNew: true });
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
    const instance = await this.connector.connect(id);
    if (!instance) throw new Error("Wallet not found");

    const [account] = await instance.getAccounts();
    if (!account) throw new Error("No account found");

    const wallet = this.wallets.find((t) => t.address === account.accountId);
    if (!wallet) throw new Error("Wallet not found");
    return wallet;
  }

  async disconnect() {
    super.disconnect();
    this.connector.disconnect();
  }
}

export default Connector;
