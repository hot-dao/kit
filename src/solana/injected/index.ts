import { Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";

import HOT from "../../hot-wallet/iframe";
import { registerWallet } from "./register";
import { GhostWallet } from "./solana-wallet";

const deserializeTransaction = (base64: string | Buffer) => {
  let buf = Buffer.alloc(0);
  if (Buffer.isBuffer(base64)) {
    buf = Buffer.from(base64);
  } else {
    const parts = base64.split(",");
    if (parts.every((t) => !isNaN(Number(t)))) buf = Buffer.from(new Uint8Array(parts.map((t) => Number(t))));
    else buf = Buffer.from(base64, "base64");
  }

  try {
    return VersionedTransaction.deserialize(buf);
  } catch (e) {
    return Transaction.from(buf);
  }
};

const hotSolana = {
  publicKey: null as PublicKey | null,

  async connect(options: any) {
    const { publicKey } = await HOT.request("solana:connect", options);
    hotSolana.publicKey = new PublicKey(publicKey);
    return { publicKey: hotSolana.publicKey };
  },

  async disconnect() {
    return await HOT.request("solana:disconnect", {});
  },

  async signAllTransactions(transactions: any[]) {
    const result = await HOT.request("solana:signAllTransactions", {
      transactions: transactions.map((t) => t.serialize().toString("base64")),
    });

    return result.transactions.map((t: any) => deserializeTransaction(t));
  },

  async signTransaction(transaction: any) {
    const result = await HOT.request("solana:signAllTransactions", {
      transactions: [transaction.serialize().toString("base64")],
    });

    return deserializeTransaction(result.transactions[0]) as any;
  },

  async signAndSendTransaction(transaction: any, options: any) {
    const result = await HOT.request("solana:signAndSendTransaction", {
      transaction: transaction.serialize().toString("base64"),
      options,
    });

    return { signature: result.signature };
  },

  async signIn(input: any) {
    throw "Not supported";
  },

  async signMessage(message: string) {
    const result = await HOT.request("solana:signMessage", { message: Buffer.from(message).toString("base64") });
    return { signature: Buffer.from(result.signature, "base64") };
  },

  off() {
    //HOT.unsubscribe(`solana:${event}`, listener);
  },

  on() {
    // HOT.subscribe(`solana:${event}`, listener);
  },
};

/*
HOT.subscribe("solana:accountChanged", (publicKey: string | null) => {
  hotSolana.publicKey = publicKey ? new PublicKey(publicKey) : null;
});
*/

registerWallet(new GhostWallet(hotSolana));

// New wallets no longer need to register wallet globals - and can
// ignore the code below. However if you have legacy apps relying on globals,
// this is the safest way to attach the reference to the window, guarding against errors.
try {
  Object.defineProperty(window, "hotSolana", { value: hotSolana });
} catch (error) {
  //
}
