import * as ed from "@noble/ed25519";
import { SignAndSendTransactionParams, SignAndSendTransactionsParams, SignMessageParams, WalletManifest } from "@hot-labs/near-connect";
import { hex, base58, base64 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import { serialize } from "borsh";

import NearWallet from "./wallet";

const Nep413MessageSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
};

export const createNearWallet = async (privateKeyBuf: Buffer, address?: string) => {
  const privateKey = privateKeyBuf.slice(0, 32);
  const publicKeyBuffer = Buffer.from(await ed.getPublicKey(privateKey));
  const addr = address || hex.encode(publicKeyBuffer);
  const publicKey = `ed25519:${base58.encode(publicKeyBuffer)}`;

  return new NearWallet(addr, publicKey, {
    manifest: {} as unknown as WalletManifest,
    signAndSendTransaction: async (params: SignAndSendTransactionParams) => {
      throw new Error("Not implemented");
    },

    signAndSendTransactions: async (params: SignAndSendTransactionsParams) => {
      throw new Error("Not implemented");
    },

    signMessage: async (params: SignMessageParams) => {
      const serializedPrefix = serialize("u32", 2147484061);
      const serializedParams = serialize(Nep413MessageSchema, params);

      const serializedMessage = new Uint8Array(serializedPrefix.length + serializedParams.length);
      serializedMessage.set(serializedPrefix);
      serializedMessage.set(serializedParams, serializedPrefix.length);

      const signature = base64.encode(await ed.sign(sha256(serializedMessage), privateKey));
      return { accountId: addr, publicKey, signature };
    },

    getAccounts: async () => [{ accountId: addr, publicKey: publicKey }],
    signIn: async () => [{ accountId: addr, publicKey: publicKey }],
    signOut: async () => {},
  });
};
