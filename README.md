# HOT Kit

`yarn add @hot-labs/kit react react-dom`

Multi-chain connector for NEAR Intents support.
Implements NEAR Intents support for the following networks:

- NEAR
- EVM
- Solana
- TON
- Stellar
- Cosmos

Also supported: Passkey accounts and Google Auth via HOT MPC Network

## Installation: Setup Vite Node polyfills and React plugins

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
import { HotConnector } from "@hot-labs/kit";
import { defaultConnectors } from "@hot-labs/kit/defaults";

const connector = new HotConnector({
  connectors: defaultConnectors,
  apiKey: "Get on https://pay.hot-labs.org/admin/api-keys for free",

  // optional get on https://dashboard.reown.com
  walletConnect: {
    projectId: "1292473190ce7eb75c9de67e15aaad99",
    metadata: {
      name: "Example App",
      description: "Example App",
      url: window.location.origin,
      icons: ["/favicon.ico"],
    },
  },
});

connector.onConnect(({ wallet }) => {});
connector.onDisconnect(({ wallet }) => {});
```

## Server side usage

On Node.js you should use `@hot-labs/kit/core` library to exclude UI functional from hot-kit

```ts
import { Intents, OmniToken } from "@hot-labs/kit/core";
import { NearWallet } from "@hot-labs/kit/near";

const wallet = await NearWallet.fromPrivateKey(Buffer.from(PRIVATE_KEY), SIGNER_ID);

await Intents.builder(wallet) //
  .give(OmniToken.USDT, 1)
  .take(OmniToken.USDC, 1)
  .execute(); // or sign or simulate
```
