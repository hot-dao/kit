import { NearConnector as NearConnectorBase } from "@hot-labs/near-connect";

import type { HotKit } from "../HotKit";

import NearConnector from "./connector";
import NearWallet from "./wallet";

export { NearConnector, NearWallet };

export default (base?: NearConnectorBase) => async (kit: HotKit) => new NearConnector(kit, base);
