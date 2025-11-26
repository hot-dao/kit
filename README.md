# Wibe3

`yarn add @hot-labs/wibe3`

Multi-chain connector for NEAR Intents support.
Implements NEAR Intents support for the following networks:

- NEAR
- EVM
- Solana
- TON
- Stellar

Also supported: Passkey accounts and Google Auth via HOT MPC Network

# Node polyfills

Wibe3 require you to install node polyfills to work, for vite you need to complete the following extra steps:

`npm install vite-plugin-node-polyfills`
Then in your vite.config.ts add the polyfills plugin.

## Getting started

```ts
const connector = new HotConnector({
  enableGoogle: true,
  projectId: "1292473190ce7eb75c9de67e15aaad99",
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

## HOT Pay

```ts
// Pay to you from any user connected wallet
const receiver = await omni.account(Chain.TON, "EU...");
await wallet.payment(OmniToken.USDT, receiver, 1);
```

## Intents builder

```ts
await wallet.intents
  .authCall({ attachNear: 10000n, msg: "", contractId: "", tgas: 50n })
  .transfer({ receiver: "root.near", token: OmniToken.USDC, amount: 1 })
  .tokenDiff({ [OmniToken.USDC]: 10, [OmniToken.NEAR]: -2 })
  .attachHashes([])
  .execute();
```

## Bridge tokens

```ts
await connector.openBridge();
```
