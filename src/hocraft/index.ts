import { HotKit } from "../HotKit";
import HotCraftConnector from "./connector";
import HotCraftWallet from "./wallet";

export { HotCraftConnector, HotCraftWallet };

export default () => async (kit: HotKit) => new HotCraftConnector(kit);
