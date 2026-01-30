import { HotConnector } from "../HotConnector";
import TronConnector from "./connector";
import TronWallet from "./wallet";
import TronWalletConnect from "./walletconnect";

export { TronConnector, TronWallet, TronWalletConnect };

export default () => async (wibe3: HotConnector) => new TronConnector(wibe3);
