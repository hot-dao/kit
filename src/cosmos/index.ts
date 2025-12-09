import CosmosConnector from "./connector";
import CosmosWallet from "./wallet";

import { HotConnector } from "../HotConnector";

export { CosmosConnector, CosmosWallet };

export default () => async (wibe3: HotConnector) => new CosmosConnector(wibe3);
