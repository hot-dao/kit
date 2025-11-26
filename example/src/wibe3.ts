import { HotConnector } from "../../src/HotConnector";

export const wibe3 = new HotConnector({
  projectId: "1292473190ce7eb75c9de67e15aaad99",
  tonWalletsUrl: "http://localhost:1241/hot-connector/tonconnect-manifest.json",
  metadata: {
    name: "HEX",
    description: "HOT Exchange",
    url: "https://hex.exchange",
    icons: ["https://hex.exchange/logo.png"],
  },
});
