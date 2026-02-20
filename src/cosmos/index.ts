import CosmosConnector from "./connector";
import CosmosWallet from "./wallet";

import { HotKit } from "../HotKit";

export { CosmosConnector, CosmosWallet };

export default ({ chainId }: { chainId?: string } = {}) =>
  async (kit: HotKit) =>
    new CosmosConnector(kit, chainId);
