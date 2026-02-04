import { HotKit } from "../HotKit";
import TronConnector from "./connector";
import TronWallet from "./wallet";

export { TronConnector, TronWallet };

export default () => async (kit: HotKit) => new TronConnector(kit);
