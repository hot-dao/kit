import CosmosConnector from "./connector";
import CosmosWallet from "./wallet";

import { HotConnector } from "../HotConnector";

export { CosmosConnector, CosmosWallet };

export default ({ chainId }: { chainId?: string } = {}) =>
  async (wibe3: HotConnector) =>
    new CosmosConnector(wibe3, chainId);
