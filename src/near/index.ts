import { NearConnector as NearConnectorBase } from "@hot-labs/near-connect";

import type { HotConnector } from "../HotConnector";

import NearConnector from "./connector";
import NearWallet from "./wallet";

export { NearConnector, NearWallet };

export default (base?: NearConnectorBase) => async (wibe3: HotConnector) => new NearConnector(wibe3, base);
