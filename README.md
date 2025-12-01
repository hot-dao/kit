# Wibe3

`yarn add @hot-labs/wibe3 react react-dom`

Multi-chain connector for NEAR Intents support.
Implements NEAR Intents support for the following networks:

- NEAR
- EVM
- Solana
- TON
- Stellar
- Cosmos

Also supported: Passkey accounts and Google Auth via HOT MPC Network

# Vite: Node polyfills and React plugins

Wibe3 require you to install node polyfills and react to work, for vite you need to complete the following extra steps:

`npm install vite-plugin-node-polyfills @vitejs/plugin-react`

Then in your vite.config.ts add this plugins:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills(), react()],
});
```

## Getting started

```ts
const connector = new HotConnector({
  // optional for WalletConnect
  projectId: "1292473190ce7eb75c9de67e15aaad99",
  // optional for WalletConnect
  metadata: {
    name: "Example App",
    description: "Example App",
    url: window.location.origin,
    icons: ["/favicon.ico"],
  },
});

connector.onConnect(({ wallet }) => {});
connector.onDisconnect(({ wallet }) => {});
```
