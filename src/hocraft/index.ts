import { HotConnector } from "../HotConnector";
import HotCraftConnector from "./connector";
import HotCraftWallet from "./wallet";

export { HotCraftConnector, HotCraftWallet };

export default () => async (wibe3: HotConnector) => new HotCraftConnector(wibe3);
