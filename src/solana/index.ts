import { HotKit } from "../HotKit";
import SolanaConnector from "./connector";
import SolanaWallet from "./wallet";
import "./injected";

export { SolanaConnector, SolanaWallet };

export default () => async (kit: HotKit) => new SolanaConnector(kit);
