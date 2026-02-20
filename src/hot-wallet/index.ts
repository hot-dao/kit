import GoogleConnector, { GoogleConnectorOptions } from "./google";
import { HotKit } from "../HotKit";

export type { GoogleConnectorOptions };
export { GoogleConnector };

export default (options?: GoogleConnectorOptions) => async (kit: HotKit) => new GoogleConnector(kit, options);
