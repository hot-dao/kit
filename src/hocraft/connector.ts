import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import { Network, WalletType } from "../core/chains";
import { OmniWallet } from "../core/OmniWallet";
import { HotConnector } from "../HotConnector";
import HotCraftWallet from "./wallet";

export default class HotCraftConnector extends OmniConnector<HotCraftWallet> {
  walletTypes = [WalletType.HotCraft];
  type = ConnectorType.HOTCRAFT;
  icon = "https://hotcraft.art/favicon-beige.ico";
  name = "HotCraft";
  id = "hotcraft";

  constructor(readonly wibe3: HotConnector) {
    super(wibe3);

    wibe3.onConnect(async ({ wallet }) => {
      if (wallet.type === WalletType.HotCraft) return;
      const craftWallet = new HotCraftWallet(wallet, wibe3.storage);
      const balances = await craftWallet.fetchBalances(Network.HotCraft);
      if (Object.values(balances).some((balance) => balance === 0n)) return;
      this.setWallet({ wallet: craftWallet, isNew: false });
    });

    wibe3.onDisconnect(async ({ wallet }) => {
      if (wallet.type === WalletType.HotCraft) return;
      const craftWallet = this.wallets.find((t) => t.wallet === wallet);
      if (craftWallet) this.removeWallet(craftWallet);
    });
  }

  async connect(id?: string): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    throw "Not supported";
  }
}
