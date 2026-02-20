import type { TonConnectorOptions } from "./connector";
import TonConnector from "./connector";
import TonWallet from "./wallet";
import "./injected";

import { HotKit } from "../HotKit";

export default (options?: TonConnectorOptions) => async (kit: HotKit) => new TonConnector(kit, options);

export { TonConnector, TonConnectorOptions, TonWallet };
