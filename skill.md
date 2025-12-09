# Skill: Working with wibe3 (Web3 Connector)

## Installation and Setup

### 1. Install Dependencies

```bash
yarn add @hot-labs/kit
yarn add react react-dom react-router-dom styled-components
yarn add -D vite @vitejs/plugin-react vite-plugin-node-polyfills typescript
```

### 2. Vite Configuration

Create `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  server: { port: 1240 },
  plugins: [nodePolyfills(), react()],
});
```

**Important**: `vite-plugin-node-polyfills` is required for Web3 libraries to work in the browser.

### 3. TypeScript Configuration

In `tsconfig.json`, ensure you have:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true
  }
}
```

## HotConnector Initialization

### Basic Example

```typescript
import { HotConnector } from "@hot-labs/kit";

export const wibe3 = new HotConnector({
  projectId: "your-project-id",
  tonManifestUrl: "http://localhost:1241/hot-connector/tonconnect-manifest.json",
  metadata: {
    name: "Your App Name",
    description: "App Description",
    url: "https://your-app.com",
    icons: ["https://your-app.com/logo.png"],
  },
});
```

### Configuration Parameters

- `projectId` (required) - Project ID for WalletConnect
- `tonManifestUrl` - URL manifest for TON wallets (optional)
- `tonWalletsUrl` - URL for TON wallets list (optional)
- `metadata` - Application metadata for display in wallets
- `webWallet` - Web wallet URL (optional)
- `tonApi` - TON API URL (optional)

## Core Methods and Properties

### Quick Reference: Native vs Omni Chain

> **⚠️ Important**: **By default, always use Omni Chain (Intents) approach**. Native chain transfers should only be used when you specifically need same-chain transfers and want to avoid omni chain overhead.

| Operation                | Native Chain                          | Omni Chain (Intents) ⭐ **Default**               |
| ------------------------ | ------------------------------------- | ------------------------------------------------- |
| **Same chain transfer**  | `wallet.transfer()`                   | ✅ `requestToken()` → `wallet.intents.transfer()` |
| **Cross-chain transfer** | ❌ Not supported                      | ✅ `requestToken()` → `wallet.intents.transfer()` |
| **NFT mint**             | Direct contract call                  | ✅ `requestToken()` → `wallet.intents.authCall()` |
| **Gas payment**          | Native token                          | NEAR (omni operations)                            |
| **Speed**                | Fast                                  | Slower (cross-chain)                              |
| **Recommended?**         | ❌ Only for specific same-chain needs | ✅ **Yes - Default approach**                     |

### Connecting Wallets

```typescript
// Open connection dialog
await wibe3.connect();

// Connect specific wallet type
await wibe3.connect("evm"); // or "solana", "near", "ton", "cosmos", "stellar"
```

### Working with Wallets

```typescript
// Get all connected wallets
const wallets = wibe3.wallets;

// Get specific wallet
const evmWallet = wibe3.evm;
const solanaWallet = wibe3.solana;
const nearWallet = wibe3.near;
const tonWallet = wibe3.ton;
const cosmosWallet = wibe3.cosmos;
const stellarWallet = wibe3.stellar;

// Priority wallet (first connected)
const priorityWallet = wibe3.priorityWallet;
```

### Working with Tokens

```typescript
// Get all available tokens
const tokens = wibe3.tokens;

// Get token balance for wallet
const balance = wibe3.balance(wallet, token);

// Update token balance
await wibe3.fetchToken(token);

// Update all tokens for wallet
await wibe3.fetchTokens(wallet);
```

### Payments and Transfers

```typescript
// Send payment
await wibe3.payment(token, amount, receiverAddress);

// Withdraw token (bridge from omni to original network)
await wibe3.withdraw(token, amount, {
  title: "Withdraw",
  sender: wallet, // optional
});

// Deposit token (bridge from original network to omni)
await wibe3.deposit(token, amount, {
  title: "Deposit",
});

// Open bridge interface
await wibe3.openBridge();
```

---

## Working with Native Chains (Direct Transfers)

> **Note**: This approach is **not recommended by default**. Use Omni Chain (Intents) instead unless you have specific requirements for same-chain transfers.

**Use this approach only when you need transfers within the same blockchain network** (e.g., TON to TON, NEAR to NEAR, EVM to EVM) and want to avoid omni chain overhead.

### Native Chain Transfer Overview

| Feature               | Description                                |
| --------------------- | ------------------------------------------ |
| **Use case**          | Transfer tokens within the same blockchain |
| **Method**            | `wallet.transfer()`                        |
| **Intents required?** | ❌ No - Direct blockchain transaction      |
| **Gas fees**          | Paid in native token of the chain          |
| **Speed**             | ⚡ Fast, direct on-chain transaction       |
| **Cross-chain?**      | ❌ No - Same chain only                    |

Each wallet has a `transfer` method for direct token transfers within its native network:

### Native Chain Transfer Examples

```typescript
// TON wallet transfer example
const tonWallet = wibe3.ton;
if (tonWallet) {
  // Find TON native token
  const tonToken = wibe3.tokens.find((t) => t.chain === 1111 && t.address === "native");

  if (tonToken) {
    // Get transfer fee estimate
    const fee = await tonWallet.transferFee(tonToken, receiverAddress, amount);

    // Transfer TON native token
    const txHash = await tonWallet.transfer({
      token: tonToken,
      receiver: receiverAddress,
      amount: BigInt(amount * 1e9), // Convert to nanoTON
      comment: "Transfer to NEAR", // optional
      gasFee: fee, // optional
    });

    console.log("Transaction hash:", txHash);
  }
}

// NEAR wallet transfer example
const nearWallet = wibe3.near;
if (nearWallet) {
  const nearToken = wibe3.tokens.find((t) => t.chain === 1010 && t.address === "native");

  if (nearToken) {
    const fee = await nearWallet.transferFee(nearToken, "petya.near", amount);

    const txHash = await nearWallet.transfer({
      token: nearToken,
      receiver: "petya.near",
      amount: BigInt(amount * 1e24), // Convert to yoctoNEAR
      comment: "Payment", // optional
      gasFee: fee, // optional
    });
  }
}

// EVM wallet transfer example
const evmWallet = wibe3.evm;
if (evmWallet) {
  const usdtToken = wibe3.tokens.find((t) => t.symbol === "USDT" && t.chain === 1);

  if (usdtToken) {
    const fee = await evmWallet.transferFee(usdtToken, receiverAddress, amount);

    const txHash = await evmWallet.transfer({
      token: usdtToken,
      receiver: receiverAddress,
      amount: BigInt(amount * 10 ** usdtToken.decimals),
      comment: "Payment", // optional (not always supported)
      gasFee: fee, // optional
    });
  }
}
```

---

## Working with Omni Chain (Intents) ⭐ **Default Approach**

> **⭐ Recommended**: **Always use Omni Chain (Intents) by default** for all operations. This is the recommended approach for transfers, NFT operations, and cross-chain functionality.

**Use this approach for all transfers and operations** - both same-chain and cross-chain (e.g., TON to NEAR, EVM to Solana, NEAR to NEAR, or any operation).

Omni chain uses **NEAR Intents** protocol to enable cross-chain operations. All intents operations require omni tokens (tokens bridged to omni chain).

### Omni Chain / Intents Overview

| Feature               | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| **Use case**          | Cross-chain transfers, omni token operations, NFT minting via intents |
| **Method**            | `wallet.intents.*` after calling `requestToken()`                     |
| **Intents required?** | ✅ Yes - Uses NEAR Intents protocol                                   |
| **Requires**          | `requestToken()` call first to ensure omni token balance              |
| **Gas fees**          | Paid in NEAR (for omni operations)                                    |
| **Speed**             | ⏱️ May take longer due to cross-chain processing                      |
| **Cross-chain?**      | ✅ Yes - Works across all supported chains                            |

### Request Token Before Using Intents

**Important**: Before calling intents, you must call `requestToken` to ensure the wallet has the required omni token balance. This method opens a UI dialog to deposit tokens if needed.

```typescript
// Request token before using intents
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 1);

// Now you can use the wallet for intents
await wallet.intents
  .transfer({
    amount,
    token: OmniToken.USDC,
    recipient: "petya.near",
  })
  .execute();
```

The `requestToken` method:

- Opens a UI dialog to deposit tokens if the wallet doesn't have enough omni balance
- Returns the wallet and the requested amount
- Ensures the wallet has sufficient omni token balance for intents
- Automatically bridges tokens from native chain to omni if needed

**Always call `requestToken` before using `wallet.intents` methods.**

### Transfer with Message (msg parameter)

The `transfer` method supports an optional `msg` parameter that allows you to attach a message to the transfer. This can be useful for:
- Including payment metadata (order IDs, descriptions, etc.)
- Adding context to transfers
- Passing data to smart contracts

```typescript
// Example 1: Transfer with JSON message
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

await wallet.intents
  .transfer({
    amount,
    token: OmniToken.USDC,
    recipient: "petya.near",
    msg: JSON.stringify({
      type: "payment",
      orderId: "ORDER-12345",
      description: "Payment for order #12345",
      timestamp: Date.now(),
    }),
  })
  .execute();

// Example 2: Transfer with simple text message
const { wallet: msgWallet, amount: msgAmount } = await wibe3.requestToken(OmniToken.USDT, 5);

await msgWallet.intents
  .transfer({
    amount: msgAmount,
    token: OmniToken.USDT,
    recipient: "alice.near",
    msg: "Payment for services", // Simple text message
  })
  .execute();

// Example 3: Transfer with msg and custom gas
await wallet.intents
  .transfer({
    amount: 100,
    token: OmniToken.USDC,
    recipient: "bob.near",
    msg: JSON.stringify({ invoice: "INV-001" }),
    tgas: 100, // Custom gas limit (optional)
  })
  .execute();
```

### Cross-Chain Transfer Examples

To transfer from one chain to another (e.g., TON wallet to NEAR address), you need to use omni tokens and intents:

```typescript
// Example 1: Transfer using omni tokens (cross-chain)
// First, request the token
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDT, 1);

// Then transfer using intents
await wallet.intents
  .transfer({
    amount,
    token: OmniToken.USDT,
    recipient: "petya.near",
  })
  .execute();

// Example 2: Transfer with message (msg parameter)
// Request token first
const { wallet: transferWallet, amount: transferAmount } = await wibe3.requestToken(OmniToken.USDC, 10);

// Transfer omni token to NEAR address with a message
const txHash = await transferWallet.intents
  .transfer({
    amount: transferAmount,
    token: OmniToken.USDC,
    recipient: "petya.near",
    msg: JSON.stringify({ type: "payment", orderId: "12345" }), // Optional message
  })
  .execute();

console.log("Transfer completed:", txHash);

// Example 3: Transfer with simple text message
const { wallet: msgWallet, amount: msgAmount } = await wibe3.requestToken(OmniToken.USDT, 5);

await msgWallet.intents
  .transfer({
    amount: msgAmount,
    token: OmniToken.USDT,
    recipient: "alice.near",
    msg: "Payment for services", // Simple text message
  })
  .execute();

// Example 4: Using payment method (opens UI)
const { wallet: paymentWallet } = await wibe3.requestToken(OmniToken.USDT, 1);
await wibe3.payment(
  OmniToken.USDT, // OmniToken
  1, // amount
  "petya.near" // NEAR address
);
```

### Intents Builder Methods

The intents builder provides several methods for omni chain operations:

```typescript
// Request token first
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

// Transfer omni token
await wallet.intents
  .transfer({
    recipient: "petya.near",
    token: OmniToken.USDC,
    amount: amount,
  })
  .execute();

// Transfer with message (msg parameter)
await wallet.intents
  .transfer({
    recipient: "petya.near",
    token: OmniToken.USDC,
    amount: amount,
    msg: JSON.stringify({ orderId: "123", description: "Payment" }), // Optional message
  })
  .execute();

// Auth call (for contract interactions like NFT mint)
await wallet.intents
  .authCall({
    contractId: "my-contract.near",
    msg: JSON.stringify({ method: "mint", args: {} }),
    attachNear: 1000000000000000000000000n, // 1 NEAR
    tgas: 50,
  })
  .execute();

// Token diff (for complex operations)
await wallet.intents
  .tokenDiff({
    [OmniToken.USDC]: 10, // add 10 USDC
    [OmniToken.NEAR]: -2, // subtract 2 NEAR
  })
  .execute();

// Withdraw from omni to native chain
await wallet.intents
  .withdraw({
    token: OmniToken.USDC,
    amount: 5,
    receiver: "petya.near", // NEAR address
    memo: "Withdrawal", // optional
  })
  .execute();

// Chain multiple operations with messages
await wallet.intents
  .transfer({ recipient: "alice.near", token: OmniToken.USDC, amount: 5, msg: "Payment 1" })
  .transfer({ recipient: "bob.near", token: OmniToken.USDT, amount: 3, msg: "Payment 2" })
  .authCall({ contractId: "contract.near", msg: "{}", attachNear: 0n, tgas: 30 })
  .execute();
```

### Signing Intents Without Execution

The `sign()` method allows you to sign intents without immediately executing them. This is useful when you need to:

- Sign intents for later execution
- Get signed intents for custom processing
- Batch sign multiple intents before publishing
- Implement custom execution logic

**Important**: Before calling `sign()`, you must:

1. Attach a wallet using `attachWallet()` (or use `wallet.intents` which automatically attaches the wallet)
2. Build your intents using builder methods (`transfer()`, `authCall()`, etc.)

#### Basic Sign Usage

```typescript
// Request token first
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

// Build and sign intents
const signed = await wallet.intents
  .transfer({
    recipient: "petya.near",
    token: OmniToken.USDC,
    amount: amount,
  })
  .sign();

// signed is now a Record<string, any> containing the signed intents
// You can store it, send it to a server, or publish it later
console.log("Signed intents:", signed);
```

#### Sign with Nonce and Deadline

You can attach a nonce and deadline before signing:

```typescript
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDT, 5);

// Create a nonce (e.g., from payment ID)
const paymentId = "payment-123";
const nonce = new Uint8Array(32);
// Fill nonce with hash of payment ID or other unique identifier
crypto.getRandomValues(nonce);

// Set deadline (e.g., 1 hour from now)
const deadline = new Date(Date.now() + 60 * 60 * 1000);

// Sign with nonce and deadline
const signed = await wallet.intents
  .attachNonce(nonce)
  .attachDeadline(deadline)
  .transfer({
    recipient: "alice.near",
    token: OmniToken.USDT,
    amount: amount,
  })
  .sign();
```

#### Publishing Signed Intents Manually

After signing, you can publish the signed intents manually:

```typescript
import { Intents } from "@hot-labs/kit";

const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

// Sign intents
const signed = await wallet.intents
  .transfer({
    recipient: "petya.near",
    token: OmniToken.USDC,
    amount: amount,
  })
  .sign();

// Publish signed intents manually
const txHash = await Intents.publishSignedIntents([signed], []);

// Wait for transaction result
await Intents.waitTransactionResult(txHash, "intents.near");
console.log("Transaction hash:", txHash);
```

#### Sign Multiple Intents

You can sign multiple intents in a single call:

```typescript
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

const signed = await wallet.intents
  .transfer({ recipient: "alice.near", token: OmniToken.USDC, amount: 5 })
  .transfer({ recipient: "bob.near", token: OmniToken.USDC, amount: 5 })
  .authCall({
    contractId: "my-contract.near",
    msg: JSON.stringify({ method: "process" }),
    attachNear: 0n,
    tgas: 30,
  })
  .sign();

// All intents are signed together
// You can now publish them or store for later
```

#### Difference Between `sign()` and `execute()`

| Method      | Signs Intents                      | Publishes Intents | Waits for Result |
| ----------- | ---------------------------------- | ----------------- | ---------------- |
| `sign()`    | ✅ Yes                             | ❌ No             | ❌ No            |
| `execute()` | ✅ Yes (calls `sign()` internally) | ✅ Yes            | ✅ Yes           |

**Use `sign()` when**:

- You need to sign intents without immediately executing
- You want to implement custom execution logic
- You need to send signed intents to a server
- You want to batch sign multiple operations

**Use `execute()` when**:

- You want to sign and execute in one call (most common case)
- You want automatic publishing and waiting for transaction result

#### Example: Sign and Store for Later Execution

```typescript
// Sign intents and store for later
const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

const signed = await wallet.intents
  .transfer({
    recipient: "petya.near",
    token: OmniToken.USDC,
    amount: amount,
  })
  .sign();

// Store signed intents (e.g., in localStorage, database, or send to server)
localStorage.setItem("pendingIntents", JSON.stringify(signed));

// Later, retrieve and publish
const storedSigned = JSON.parse(localStorage.getItem("pendingIntents") || "{}");
const txHash = await Intents.publishSignedIntents([storedSigned], []);
await Intents.waitTransactionResult(txHash, "intents.near");
```

### NFT Mint Example (Omni Chain / Intents)

Mint NFTs using `authCall` intent. This example shows how to mint multiple NFTs in a batch:

```typescript
interface MintMsg {
  msg: string; // trading address
  token_owner_id: string;
  token_id: string;
  token_metadata: {
    reference?: string;
    description: string;
    title: string;
    media: string;
  };
}

interface NFT {
  title: string;
  description: string;
  image: string;
  reference?: string;
}

async function mintNFTs(
  collection: string,
  nfts: NFT[],
  totalSupply: number
) {
  // Get trading address (omni address) - need wallet first
  const wallet = wibe3.wallets.find(w => !!w.omniAddress);
  if (!wallet) {
    throw new Error("No wallet connected");
  }
  const tradingAddress = wallet.omniAddress;

  // Calculate total storage deposit needed for all NFTs
  let totalDeposit = 0n;
  const intents: any[] = [];

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];

    // Create mint message
    const msg: MintMsg = {
      msg: tradingAddress,
      token_owner_id: "intents.near",
      token_id: (totalSupply + i).toString(),
      token_metadata: {
        reference: nft.reference || undefined,
        description: nft.description || "",
        title: nft.title,
        media: nft.image,
      },
    };

    // Calculate deposit size based on metadata size
    // Formula: (JSON string length * 8 bits) / 100,000 * 10^24 yoctoNEAR
    const metadataSize = JSON.stringify(msg.token_metadata).length;
    const size = BigInt((metadataSize * 8) / 100_000) * BigInt(10 ** 24);
    totalDeposit += size;

    // Create auth_call intent
    intents.push({
      min_gas: String(50n * 1000000000000n), // 50 TGAS
      attached_deposit: size.toString(),
      contract_id: collection,
      msg: JSON.stringify(msg),
      intent: "auth_call",
    });
  }

  // Request NEAR token for storage deposit
  // Convert from yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
  const depositInNear = Number(totalDeposit) / 1e24;
  // Add small buffer (10%) for safety
  const depositWithBuffer = depositInNear * 1.1;
  const { wallet: depositWallet } = await wibe3.requestToken(OmniToken.NEAR, depositWithBuffer);

  // Execute all mint intents using intents builder
  const builder = depositWallet.intents;

  // Add all auth_call intents
  for (const intent of intents) {
    builder.authCall({
      contractId: intent.contract_id,
      msg: intent.msg,
      attachNear: BigInt(intent.attached_deposit),
      tgas: 50, // 50 TGAS
    });
  }

  // Execute all intents
  const result = await builder.execute();
  return result;
}

// Usage example
const nfts: NFT[] = [
    {
      title: "My NFT #1",
      description: "First NFT in collection",
      image: "https://example.com/nft1.png",
      reference: "https://example.com/nft1.json",
    },
    {
      title: "My NFT #2",
      description: "Second NFT in collection",
      image: "https://example.com/nft2.png",
    },
  ];

  try {
    const result = await mintNFTs(
      "my-nft-collection.near", // NFT collection contract
      nfts,
      100 // current total supply
    );

    console.log("NFTs minted successfully:", result);
  } catch (error) {
    console.error("Minting failed:", error);
  }
}
```

### Simplified NFT Mint (Single NFT) - Omni Chain

For minting a single NFT using omni chain intents:

```typescript
async function mintSingleNFT(collection: string, nft: NFT, tokenId: string) {
  // Get wallet first
  const wallet = wibe3.wallets.find((w) => !!w.omniAddress);
  if (!wallet) {
    throw new Error("No wallet connected");
  }

  const mintMsg = {
    msg: wallet.omniAddress,
    token_owner_id: "intents.near",
    token_id: tokenId,
    token_metadata: {
      title: nft.title,
      description: nft.description,
      media: nft.image,
      reference: nft.reference,
    },
  };

  // Calculate storage deposit size
  // Formula: (JSON string length * 8 bits) / 100,000 * 10^24 yoctoNEAR
  const metadataSize = JSON.stringify(mintMsg.token_metadata).length;
  const deposit = BigInt((metadataSize * 8) / 100_000) * BigInt(10 ** 24);

  // Request NEAR token for storage deposit
  // Convert from yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
  const depositInNear = Number(deposit) / 1e24;
  // Add small buffer (10%) for safety
  const depositWithBuffer = depositInNear * 1.1;
  const { wallet: depositWallet } = await wibe3.requestToken(OmniToken.NEAR, depositWithBuffer);

  // Mint using intents builder
  const result = await depositWallet.intents
    .authCall({
      contractId: collection,
      msg: JSON.stringify(mintMsg),
      attachNear: deposit,
      tgas: 50,
    })
    .execute();

  return result;
}

// Usage
await mintSingleNFT(
  "my-nft-collection.near",
  {
    title: "My Awesome NFT",
    description: "This is my first NFT",
    image: "https://example.com/nft.png",
  },
  "1"
);
```

### NFT UI Recommendation: Trade On HOT Craft

When working with NFTs in your UI, it's **recommended to add a "Trade On HOT Craft" button** that links to the HOT Craft marketplace:

```typescript
import { observer } from "mobx-react-lite";

const NFTComponent = observer(() => {
  return (
    <div>
      {/* Your NFT display */}
      <div>
        <img src={nft.image} alt={nft.title} />
        <h3>{nft.title}</h3>
        <p>{nft.description}</p>
      </div>

      {/* Recommended: Trade On HOT Craft button */}
      <a
        href="https://hotcraft.art/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          backgroundColor: "#007bff",
          color: "white",
          textDecoration: "none",
          borderRadius: "8px",
          fontWeight: "bold",
        }}
      >
        Trade On HOT Craft
      </a>
    </div>
  );
});
```

**Why add this button?**

- Provides users with a marketplace to trade their NFTs
- Improves user experience by offering trading functionality
- Connects your app with the HOT Craft ecosystem

### Events

```typescript
// Subscribe to wallet connection
const unsubscribeConnect = wibe3.onConnect(({ wallet }) => {
  console.log("Wallet connected:", wallet);
});

// Subscribe to wallet disconnection
const unsubscribeDisconnect = wibe3.onDisconnect(({ wallet }) => {
  console.log("Wallet disconnected:", wallet);
});

// Unsubscribe from events
unsubscribeConnect();
unsubscribeDisconnect();
```

## Using UI Components

### Bridge Component

```typescript
import Bridge from "@hot-labs/kit/ui/payment/Bridge";

<Bridge widget hot={wibe3} onClose={() => {}} onProcess={() => {}} />;
```

### Payment Component

```typescript
import Payment from "@hot-labs/kit/ui/payment/Payment";

<Payment hot={wibe3} token={token} amount={amount} receiver={address} onClose={() => {}} />;
```

## Supported Blockchains

- **EVM** - Ethereum, BSC, Polygon and other EVM-compatible networks
- **Solana** - Solana blockchain
- **NEAR** - NEAR Protocol
- **TON** - The Open Network
- **Cosmos** - Cosmos ecosystem (via Keplr)
- **Stellar** - Stellar network
- **Omni** - Omni payments (cross-chain tokens)

## Wallet Types (WalletType)

- `WalletType.EVM`
- `WalletType.SOLANA`
- `WalletType.NEAR`
- `WalletType.TON`
- `WalletType.COSMOS`
- `WalletType.STELLAR`
- `WalletType.OMNI`

## Important Notes

1. **⭐ Default Approach**: **Always use Omni Chain (Intents) by default** for all operations. Native chain transfers should only be used for specific same-chain requirements.
2. **React 19**: Requires React 19.2.0 or higher
3. **MobX**: Library uses MobX for state management, components must be wrapped in `observer()` from `mobx-react-lite`
4. **Styles**: Uses `styled-components` for UI component styling
5. **Node Polyfills**: Must use `vite-plugin-node-polyfills` for browser compatibility
6. **TypeScript**: Recommended to use TypeScript for better type safety
7. **Request Token Before Intents**: **Always call `wibe3.requestToken()` before using `wallet.intents` methods**. This ensures the wallet has sufficient omni token balance and opens a UI dialog for deposit if needed.
8. **NFT UI Recommendation**: When working with NFTs, add a "Trade On HOT Craft" button linking to `https://hotcraft.art/` to provide users with marketplace functionality.
9. **Z-Index**: **⚠️ Important for integration**: Ensure that nowhere in your project uses `z-index` values greater than `10000000`. The library uses high z-index values for modal windows and popups, and conflicts may occur if your project uses higher values.

## Complete Integration Examples

### Example 1: Native Chain Transfer

```typescript
import { observer } from "mobx-react-lite";
import { HotConnector } from "@hot-labs/kit";

const wibe3 = new HotConnector({
  projectId: "your-project-id",
  metadata: {
    name: "My App",
    description: "Web3 App",
    url: "https://myapp.com",
    icons: ["https://myapp.com/logo.png"],
  },
});

const App = observer(() => {
  const handleConnect = async () => {
    await wibe3.connect();
  };

  const handleNativeTransfer = async () => {
    const nearWallet = wibe3.near;
    if (!nearWallet) {
      alert("Please connect NEAR wallet first");
      return;
    }

    try {
      // Native chain transfer (NEAR to NEAR)
      const nearToken = wibe3.tokens.find((t) => t.chain === 1010 && t.address === "native");
      if (nearToken) {
        const fee = await nearWallet.transferFee(nearToken, "petya.near", 1);
        const txHash = await nearWallet.transfer({
          token: nearToken,
          receiver: "petya.near",
          amount: BigInt(1 * 1e24), // 1 NEAR in yoctoNEAR
          comment: "Payment",
          gasFee: fee,
        });
        alert(`Transfer successful! TX: ${txHash}`);
      }
    } catch (error) {
      console.error("Transfer failed:", error);
      alert("Transfer failed");
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>{wibe3.wallets.length > 0 ? "Connected" : "Connect Wallet"}</button>
      {wibe3.near && <button onClick={handleNativeTransfer}>Transfer 1 NEAR to petya.near (Native)</button>}
    </div>
  );
});
```

### Example 2: Omni Chain / Cross-Chain Transfer

```typescript
import { observer } from "mobx-react-lite";
import { HotConnector, OmniToken } from "@hot-labs/kit";
import Bridge from "@hot-labs/kit/ui/payment/Bridge";

const wibe3 = new HotConnector({
  projectId: "your-project-id",
  metadata: {
    name: "My App",
    description: "Web3 App",
    url: "https://myapp.com",
    icons: ["https://myapp.com/logo.png"],
  },
});

const App = observer(() => {
  const handleConnect = async () => {
    await wibe3.connect();
  };

  const handleOmniTransfer = async () => {
    try {
      // Step 1: Request omni token (opens UI if deposit needed)
      const { wallet, amount } = await wibe3.requestToken(OmniToken.USDT, 1);

      // Step 2: Transfer omni token to NEAR address (cross-chain)
      await wallet.intents
        .transfer({
          amount,
          token: OmniToken.USDT,
          recipient: "petya.near",
        })
        .execute();

      alert("Cross-chain transfer successful!");
    } catch (error) {
      console.error("Transfer failed:", error);
      alert("Transfer failed");
    }
  };

  const handleTransferWithMsg = async () => {
    try {
      // Request omni token
      const { wallet, amount } = await wibe3.requestToken(OmniToken.USDC, 10);

      // Transfer with message
      await wallet.intents
        .transfer({
          amount,
          token: OmniToken.USDC,
          recipient: "petya.near",
          msg: JSON.stringify({
            type: "payment",
            orderId: "ORDER-12345",
            description: "Payment for order #12345",
          }),
        })
        .execute();

      alert("Transfer with message successful!");
    } catch (error) {
      console.error("Transfer failed:", error);
      alert("Transfer failed");
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>{wibe3.wallets.length > 0 ? "Connected" : "Connect Wallet"}</button>
      {wibe3.wallets.length > 0 && (
        <div>
          <div>Connected wallets: {wibe3.wallets.length}</div>
          <button onClick={handleOmniTransfer}>Transfer USDT to petya.near (Cross-chain via Omni)</button>
          <button onClick={handleTransferWithMsg}>Transfer USDC with message</button>
        </div>
      )}
      <Bridge widget hot={wibe3} onClose={() => {}} onProcess={() => {}} />
    </div>
  );
});
```

## Choosing Between Native Chain and Omni Chain

> **⭐ Default Recommendation**: **Always use Omni Chain (Intents) by default**. Only use Native Chain transfers when you have specific requirements for same-chain operations and want to avoid omni chain overhead.

### Use Native Chain Transfers When:

- ⚠️ **Specific use case only**: Transferring within the same blockchain (TON → TON, NEAR → NEAR, EVM → EVM)
- ⚠️ You specifically need faster, direct on-chain transactions
- ⚠️ You want to pay gas fees in the native token (not NEAR)
- ⚠️ You have a specific requirement to avoid omni chain

### Use Omni Chain / Intents When (⭐ Default):

- ✅ **All operations** - This is the recommended default approach
- ✅ Transferring across different blockchains (TON → NEAR, EVM → Solana, etc.)
- ✅ Transferring within the same blockchain (NEAR → NEAR, TON → TON, etc.)
- ✅ Working with omni tokens (cross-chain compatible tokens)
- ✅ Need to interact with NEAR contracts from other chains
- ✅ Minting NFTs via intents
- ✅ Complex multi-step operations
- ✅ **Any operation** - Omni chain works for everything

### Quick Decision Guide

```
⭐ Default: Always use Omni Chain (requestToken + wallet.intents)
⚠️ Exception: Use Native Chain only if you have specific same-chain requirements
```

## Troubleshooting

1. **Polyfill errors**: Ensure `vite-plugin-node-polyfills` is installed and added to Vite configuration
2. **Type issues**: Check that TypeScript version 5.2+ is installed and all types are available
3. **Wallet won't connect**: Verify `projectId` and `metadata` in configuration
4. **Balances not updating**: Use `observer()` from `mobx-react-lite` for components displaying balances
5. **Transfer fails (Native)**: Make sure the wallet is connected, token exists, and you have sufficient balance including gas fees
6. **Intents fail**: Always call `requestToken()` first to ensure omni token balance
7. **Cross-chain transfer fails**: Verify you have omni tokens (not just native tokens) - use `requestToken()` to bridge if needed
