import StellarConnector from "./connector";
import StellarWallet from "./wallet";
import { HotKit } from "../HotKit";

export { StellarConnector, StellarWallet };

export default () => async (kit: HotKit) => new StellarConnector(kit);
