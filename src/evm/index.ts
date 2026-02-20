import EvmConnector from "./connector";
import { HotKit } from "../HotKit";

export { default as EvmConnector } from "./connector";
export { default as EvmWallet } from "./wallet";
import "./injected";

export default () => async (kit: HotKit) => new EvmConnector(kit);
