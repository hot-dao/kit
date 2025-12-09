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

// Tree-shaking - use only chains what you need
import stellar from "@hot-labs/kit/stellar";
import solana from "@hot-labs/kit/solana";
import cosmos from "@hot-labs/kit/cosmos";
import near from "@hot-labs/kit/near";
import ton from "@hot-labs/kit/ton";
import evm from "@hot-labs/kit/evm";

const connector = new HotConnector({
  connectors: [near(), evm(), solana(), ton(), stellar(), cosmos()],

  // optional
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

On Node.js you can't use `@hot-labs/kit` because it's client-side library with UI dependencies, but you can use core package for working with Intents primitives and HotBridge primitives

```ts
import { Intents, OmniToken } from "@hot-labs/kit/core";

await Intents.builder //
  .give(OmniToken.USDT, 1)
  .take(OmniToken.USDC, 1)
  .attachCommitment(signedCommitment)
  .attachSigner({ ed25519PrivateKey: Buffer }) // omniAddress as optional, default use hex of public key
  .execute(); // or sign or simulate
```
