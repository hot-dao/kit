import { sha256 } from "@noble/hashes/sha2.js";

import type { HotConnector } from "../HotConnector";
import type { OmniWallet } from "../OmniWallet";
import { rpc } from "../near/rpc";

import type { Intent, Commitment, TokenDiffIntent, MtWithdrawIntent, FtWithdrawIntent, NftWithdrawIntent, TransferIntent } from "./types";
import { OmniToken } from "./chains";
import { tokens } from "./tokens";
import { formatter } from "./utils";
import { api } from "./api";

import { openPayment } from "../ui/router";

export const TGAS = 1000000000000n;

export class Intents {
  constructor(readonly wibe3?: HotConnector) {}

  static get builder() {
    return new Intents();
  }

  signedHashes: string[] = [];
  commitments: Commitment[] = [];
  need = new Map<OmniToken, bigint>();
  signer?: OmniWallet;

  unsignedCommitment: {
    intents: Intent[];
    nonce?: Uint8Array;
    deadline?: Date;
  } = {
    intents: [],
    nonce: undefined,
    deadline: undefined,
  };

  addNeed(token: OmniToken, amount: bigint) {
    if (!this.need.has(token)) this.need.set(token, 0n);
    this.need.set(token, this.need.get(token)! + amount);
    return this;
  }

  authCall(args: { contractId: string; msg: string; attachNear: bigint; tgas: number }) {
    this.addNeed(OmniToken.NEAR, args.attachNear);
    this.unsignedCommitment.intents.push({
      min_gas: (BigInt(args.tgas) * TGAS).toString(),
      attached_deposit: args.attachNear.toString(),
      contract_id: args.contractId,
      intent: "auth_call",
      msg: args.msg,
    });

    return this;
  }

  /**
   * Use this method to pay for a merchant's item created in pay.hot-labs.org
   */
  merchantPayment({ merchantId, token, itemId, email, amount, memo }: { token: OmniToken; merchantId: string; itemId: string; amount: number | bigint; memo: string; email: string }) {
    return this.transfer({
      msg: JSON.stringify({ merchant_id: merchantId, item_id: itemId, memo: memo }),
      recipient: "pay.fi.tg",
      amount,
      token,
    }).yieldExecute({ email });
  }

  transfer(args: { recipient: string; token: OmniToken; amount: number | bigint; memo?: string; msg?: string; tgas?: number }) {
    const omniToken = tokens.get(args.token);
    const amount = (typeof args.amount === "number" ? omniToken.int(args.amount) : args.amount).toString();
    const intent: TransferIntent = {
      min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
      tokens: { [omniToken.omniAddress]: amount },
      receiver_id: args.recipient.toLowerCase(),
      intent: "transfer",
      memo: args.memo,
      msg: args.msg,
    };

    this.addNeed(args.token, BigInt(amount));
    this.unsignedCommitment.intents.push(intent);
    return this;
  }

  batchTransfer(args: { recipient: string; tokens: Record<OmniToken, number | bigint>; memo?: string; msg?: string; tgas?: number }) {
    const tokensList: Record<string, string> = {};
    for (const [token, amount] of Object.entries(args.tokens)) {
      const omniToken = tokens.get(token);
      const amountStr = typeof amount === "number" ? omniToken.int(amount).toString() : amount.toString();
      tokensList[omniToken.omniAddress] = amountStr;
      this.addNeed(token as OmniToken, BigInt(amountStr));
    }

    const intent: TransferIntent = {
      intent: "transfer",
      receiver_id: args.recipient.toLowerCase(),
      min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
      tokens: tokensList,
      memo: args.memo,
      msg: args.msg,
    };

    this.unsignedCommitment.intents.push(intent);
    return this;
  }

  tokenDiff(args: Record<string, bigint | number>) {
    const parse = (token: OmniToken, amount: bigint | number): [string, string] => {
      if (typeof amount === "number") return [token.toString(), tokens.get(token).int(amount).toString()];
      return [token.toString(), amount.toString()];
    };

    const intent: TokenDiffIntent = {
      diff: Object.fromEntries(Object.entries(args).map(([token, amount]) => parse(token as OmniToken, amount))),
      intent: "token_diff",
    };

    for (const [token, amountStr] of Object.entries(intent.diff)) {
      const amount = BigInt(amountStr);
      if (amount < 0n) {
        const tokenKey = token as OmniToken;
        this.addNeed(tokenKey, -amount);
      }
    }

    this.unsignedCommitment.intents.push(intent);
    return this;
  }

  addRawIntent(rawIntent: Intent) {
    if (!rawIntent.intent) throw new Error("Intent must have 'intent' field");
    const intentType = rawIntent.intent;

    if (intentType === "token_diff") {
      const tokenDiffArgs: Record<OmniToken, bigint> = {} as Record<OmniToken, bigint>;
      for (const [token, amountStr] of Object.entries(rawIntent.diff)) {
        tokenDiffArgs[token as OmniToken] = BigInt(amountStr as string);
      }
      return this.tokenDiff(tokenDiffArgs);
    }

    if (intentType === "transfer") {
      const tokens: Record<OmniToken, bigint> = {} as Record<OmniToken, bigint>;
      for (const [token, amount] of Object.entries(rawIntent.tokens)) {
        tokens[token as OmniToken] = BigInt(amount as string);
      }

      return this.batchTransfer({
        tgas: rawIntent.min_gas ? Number(BigInt(rawIntent.min_gas) / TGAS) : undefined,
        recipient: rawIntent.receiver_id,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        tokens,
      });
    }

    if (intentType === "mt_withdraw") {
      for (let i = 0; i < rawIntent.amounts.length; i++) {
        const token = `nep245:${rawIntent.token}:${rawIntent.token_ids[i]}` as OmniToken;
        this.addNeed(token, BigInt(rawIntent.amounts[i]));
      }

      this.unsignedCommitment.intents.push({
        intent: "mt_withdraw",
        amounts: rawIntent.amounts,
        receiver_id: rawIntent.receiver_id,
        token_ids: rawIntent.token_ids,
        token: rawIntent.token,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        min_gas: rawIntent.min_gas,
      } as MtWithdrawIntent);
      return this;
    }

    if (intentType === "ft_withdraw") {
      return this.withdraw({
        token: `nep141:${rawIntent.token}`,
        amount: BigInt(rawIntent.amount),
        receiver: rawIntent.receiver_id,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
      });
    }

    if (intentType === "auth_call") {
      return this.authCall({
        attachNear: BigInt(rawIntent.attached_deposit),
        tgas: Number(BigInt(rawIntent.min_gas) / TGAS),
        contractId: rawIntent.contract_id,
        msg: rawIntent.msg,
      });
    }

    if (intentType === "add_public_key") {
      return this.addPublicKey(rawIntent.public_key);
    }

    if (intentType === "remove_public_key") {
      return this.removePublicKey(rawIntent.public_key);
    }

    if (intentType === "nft_withdraw") {
      return this.withdraw({
        token: rawIntent.token_id,
        receiver: rawIntent.receiver_id,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        tgas: rawIntent.min_gas ? Number(BigInt(rawIntent.min_gas) / TGAS) : undefined,
        amount: 1n,
      });
    }

    throw new Error(`Unsupported intent type: ${intentType}`);
  }

  addPublicKey(publicKey: string) {
    this.unsignedCommitment.intents.push({ intent: "add_public_key", public_key: publicKey });
    return this;
  }

  removePublicKey(publicKey: string) {
    this.unsignedCommitment.intents.push({ intent: "remove_public_key", public_key: publicKey });
    return this;
  }

  withdraw(args: { token: string; amount: number | bigint; receiver: string; memo?: string; msg?: string; tgas?: number }) {
    const omniToken = tokens.get(args.token);
    const amount = (typeof args.amount === "number" ? omniToken.int(args.amount) : args.amount).toString();
    const [standart, ...tokenParts] = args.token.split(":");
    this.addNeed(args.token as OmniToken, BigInt(amount));

    if (standart === "nep245") {
      const mtContract = tokenParts[0];
      const tokenId = tokenParts.slice(1).join(":");
      this.unsignedCommitment.intents.push({
        intent: "mt_withdraw",
        amounts: [amount],
        receiver_id: args.receiver,
        token_ids: [tokenId],
        token: mtContract,
        memo: args.memo,
        msg: args.msg,
        min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
      } as MtWithdrawIntent);
      return this;
    }

    if (standart === "nep141") {
      this.unsignedCommitment.intents.push({
        intent: "ft_withdraw",
        receiver_id: args.receiver,
        token: tokenParts.join(":"),
        amount: amount,
        memo: args.memo,
        msg: args.msg,
      } as FtWithdrawIntent);
      return this;
    }

    if (standart === "nep171") {
      this.unsignedCommitment.intents.push({
        intent: "nft_withdraw",
        receiver_id: args.receiver,
        token_id: tokenParts.join(":"),
        min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
        memo: args.memo,
        msg: args.msg,
      } as NftWithdrawIntent);
      return this;
    }

    throw new Error(`Unsupported token: ${args.token}`);
  }

  attachHashes(hashes: string[]) {
    this.signedHashes.push(...hashes);
    return this;
  }

  attachWallet(wallet?: OmniWallet) {
    this.signer = wallet;
    return this;
  }

  attachDeadline(deadline: Date) {
    this.unsignedCommitment.deadline = deadline;
    return this;
  }

  attachNonce(nonce: Uint8Array) {
    this.unsignedCommitment.nonce = nonce;
    return this;
  }

  attachTimeout(seconds: number) {
    this.unsignedCommitment.deadline = new Date(Date.now() + seconds * 1000);
    return this;
  }

  attachSeed(seed: string) {
    this.unsignedCommitment.nonce = new Uint8Array(sha256(new TextEncoder().encode(seed))).slice(0, 32);
    return this;
  }

  attachCommitment(commitment: Commitment) {
    this.commitments.push(commitment);
    return this;
  }

  take(token: string, amount: number | bigint) {
    const intAmount = typeof amount === "number" ? tokens.get(token).int(amount) : amount;

    // this.addNeed(token, -intAmount); Do we need to add the need here?
    const tokenDiff = this.unsignedCommitment.intents.find((intent) => intent.intent === "token_diff");

    if (tokenDiff) tokenDiff.diff[token.toString()] = intAmount.toString();
    else this.unsignedCommitment.intents.push({ intent: "token_diff", diff: { [token.toString()]: intAmount.toString() } });
    return this;
  }

  give(token: string, amount: number | bigint) {
    const intAmount = typeof amount === "number" ? tokens.get(token).int(amount) : amount;

    this.addNeed(token as OmniToken, intAmount);
    const tokenDiff = this.unsignedCommitment.intents.find((intent) => intent.intent === "token_diff");

    if (tokenDiff) tokenDiff.diff[token.toString()] = (-intAmount).toString();
    else this.unsignedCommitment.intents.push({ intent: "token_diff", diff: { [token.toString()]: (-intAmount).toString() } });
    return this;
  }

  async signSequence() {
    const signer = this.signer;
    if (!signer) throw new Error("No signer attached");
    if (!signer.omniAddress) throw new Error("No omni address");

    const commitments: Commitment[] = [];
    for (const intent of this.unsignedCommitment.intents) {
      commitments.push(
        await signer.signIntents([intent], {
          deadline: this.unsignedCommitment.deadline ? +this.unsignedCommitment.deadline : undefined,
          nonce: this.unsignedCommitment.nonce,
        })
      );
    }

    return commitments;
  }

  async sign() {
    const signer = this.signer;
    if (!signer) throw new Error("No signer attached");
    if (!signer.omniAddress) throw new Error("No omni address");
    const commitment = await signer.signIntents(this.unsignedCommitment.intents, {
      deadline: this.unsignedCommitment.deadline ? +this.unsignedCommitment.deadline : undefined,
      nonce: this.unsignedCommitment.nonce,
    });

    this.unsignedCommitment = { intents: [] };
    this.commitments.push(commitment);
    return this;
  }

  async simulate() {
    if (this.commitments.length === 0) throw new Error("No commitments attached");
    return await Intents.simulateIntents(this.commitments);
  }

  async yieldExecute(payload?: Record<string, any>) {
    if (!this.wibe3) throw new Error("No wibe3 attached");
    const { depositQoute, processing } = await openPayment(this.wibe3, this);
    const depositAddress = depositQoute === "direct" ? undefined : typeof depositQoute?.qoute === "object" ? depositQoute?.qoute?.depositAddress : undefined;

    if (depositAddress) {
      const { near_trx } = await api.yieldIntentCall({ depositAddress, commitment: this.commitments[0], payload });
      return near_trx;
    }

    await processing?.();
    return this.execute();
  }

  async depositAndExecute() {
    if (!this.wibe3) throw new Error("No wibe3 attached");
    const { processing } = await openPayment(this.wibe3, this);
    await processing?.();
    return this.execute();
  }

  async execute() {
    const task = Intents.publish(this.commitments, this.signedHashes);
    this.commitments = [];
    this.signedHashes = [];

    const hash = await task;
    await rpc.waitTransactionResult(hash, "intents.near");
    return hash;
  }

  async executeBatch(params = { checkTokens: true, chunkSize: this.unsignedCommitment.intents.length, onSuccess: (bucket: number, hash: string) => {} }) {
    if (this.commitments.length === 0) throw new Error("No commitments attached");
    const batches = formatter.chunk(this.unsignedCommitment.intents, params.chunkSize);
    let index = 0;

    const hashes: string[] = [];
    for (const batch of batches) {
      this.unsignedCommitment.intents = batch;
      const hash = await this.sign().then(() => this.execute());
      params.onSuccess(index++, hash);
      hashes.push(hash);
    }

    return hashes;
  }

  static async publish(signed: Commitment[], hashes: string[] = []): Promise<string> {
    const result = await api.publishIntents(signed, hashes);
    if (result.status === "FAILED") throw result.reason;
    const intentResult = result.intent_hashes[0];

    const getStatus = async () => {
      const statusResult = await api.getIntentsStatus(intentResult);
      return statusResult;
    };

    const fetchResult = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const result = await getStatus().catch(() => null);
      if (result == null) return await fetchResult();
      if (result.status === "SETTLED") return result.data.hash;
      if (result.status === "FAILED") throw result.reason || "Failed to publish intents";
      return await fetchResult();
    };

    const hash = await fetchResult();
    return hash;
  }

  static async hasPublicKey(accountId: string, publicKey: string): Promise<boolean> {
    return await rpc.viewMethod({
      args: { account_id: accountId, public_key: publicKey },
      methodName: "has_public_key",
      contractId: "intents.near",
    });
  }

  static async simulateIntents(signed: Commitment[]) {
    return await rpc.viewMethod({
      args: { signed: signed },
      methodName: "simulate_intents",
      contractId: "intents.near",
    });
  }

  static async getIntentsBalances(assets: string[], accountId: string): Promise<Record<string, bigint>> {
    const balances = await rpc.viewMethod({
      args: { token_ids: assets, account_id: accountId },
      methodName: "mt_batch_balance_of",
      contractId: "intents.near",
    });

    return Object.fromEntries(assets.map((asset, index) => [asset, BigInt(balances[index] || 0n)]));
  }

  static async getIntentsAssets(accountId: string): Promise<string[]> {
    const assets: string[] = [];
    const limit = 250;
    let fromIndex = 0n;

    for (;;) {
      const balances = await rpc.viewMethod({
        args: { account_id: accountId, from_index: fromIndex.toString(), limit },
        methodName: "mt_tokens_for_owner",
        contractId: "intents.near",
      });

      assets.push(...balances.map((b: any) => b.token_id));
      if (balances.length < limit) break;
      fromIndex += BigInt(limit);
    }

    return assets;
  }
}
