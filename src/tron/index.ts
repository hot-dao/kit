import { HotKit } from "../HotKit";
import TronConnector from "./connector";
import TronWallet from "./wallet";
import TronWalletConnect from "./walletconnect";

export { TronConnector, TronWallet, TronWalletConnect };

export default () => async (kit: HotKit) => new TronConnector(kit);
