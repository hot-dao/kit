import GoogleConnector, { GoogleConnectorOptions } from "./google";
import { HotConnector } from "../HotConnector";

export type { GoogleConnectorOptions };
export { GoogleConnector };

export default (options?: GoogleConnectorOptions) => async (wibe3: HotConnector) => new GoogleConnector(wibe3, options);
