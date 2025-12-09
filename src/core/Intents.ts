import { sha256 } from "@noble/hashes/sha2.js";
import { ed25519 } from "@noble/curves/ed25519";
import { base58, base64, hex } from "@scure/base";

import type { HotConnector } from "../HotConnector";
import type { OmniWallet } from "../OmniWallet";
import type { TransferIntent, MtWithdrawIntent, FtWithdrawIntent, TokenDiffIntent, AuthCallIntent } from "./types";

import { OmniToken } from "./chains";
import { tokens } from "./tokens";
import { rpc } from "./nearRpc";

export const TGAS = 1000000000000n;

export class Intents {
  constructor(readonly wibe3?: HotConnector) {}

  static get builder() {
    return new Intents();
  }

  hashes: string[] = [];
  intents: (TransferIntent | MtWithdrawIntent | FtWithdrawIntent | TokenDiffIntent | AuthCallIntent)[] = [];
  nonce?: Uint8Array;
  deadline?: Date;
  signer?: OmniWallet | { ed25519PrivateKey: Uint8Array; omniAddress?: string };

  commitments: Record<string, any>[] = [];
  need = new Map<OmniToken, bigint>();

  addNeed(token: OmniToken, amount: bigint) {
    if (!this.need.has(token)) this.need.set(token, 0n);
    this.need.set(token, this.need.get(token)! + amount);
    return this;
  }

  authCall(args: { contractId: string; msg: string; attachNear: bigint; tgas: number }) {
    this.addNeed(OmniToken.NEAR, args.attachNear);
    this.intents.push({
      min_gas: (BigInt(args.tgas) * TGAS).toString(),
      attached_deposit: args.attachNear.toString(),
      contract_id: args.contractId,
      intent: "auth_call",
      msg: args.msg,
    });

    return this;
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
    this.intents.push(intent);
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

    this.intents.push(intent);
    return this;
  }

  tokenDiff(args: Record<OmniToken, bigint | number>) {
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

    this.intents.push(intent);
    return this;
  }

  addRawIntent(rawIntent: Record<string, any>) {
    if (!rawIntent.intent) throw new Error("Intent must have 'intent' field");
    const intentType = rawIntent.intent;

    if (intentType === "token_diff") {
      const diff = rawIntent.diff || rawIntent.token_diff;
      if (!diff) throw new Error("token_diff intent must have 'diff' or 'token_diff' field");

      const tokenDiffArgs: Record<OmniToken, bigint> = {} as Record<OmniToken, bigint>;
      for (const [token, amountStr] of Object.entries(diff)) {
        tokenDiffArgs[token as OmniToken] = BigInt(amountStr as string);
      }
      return this.tokenDiff(tokenDiffArgs);
    }

    if (intentType === "transfer") {
      if (!rawIntent.tokens || !rawIntent.receiver_id) {
        throw new Error("transfer intent must have 'tokens' and 'receiver_id' fields");
      }

      const tokens: Record<OmniToken, bigint> = {} as Record<OmniToken, bigint>;
      for (const [token, amount] of Object.entries(rawIntent.tokens)) {
        tokens[token as OmniToken] = BigInt(amount as string);
      }
      return this.batchTransfer({
        recipient: rawIntent.receiver_id,
        tokens,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        tgas: rawIntent.min_gas ? Number(BigInt(rawIntent.min_gas) / TGAS) : undefined,
      });
    }

    if (intentType === "mt_withdraw") {
      const intent: MtWithdrawIntent = {
        intent: "mt_withdraw",
        amounts: rawIntent.amounts,
        receiver_id: rawIntent.receiver_id,
        token_ids: rawIntent.token_ids,
        token: rawIntent.token,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        min_gas: rawIntent.min_gas,
      };

      for (let i = 0; i < rawIntent.amounts.length; i++) {
        const token = `nep245:${rawIntent.token}:${rawIntent.token_ids[i]}` as OmniToken;
        this.addNeed(token, BigInt(rawIntent.amounts[i]));
      }

      this.intents.push(intent);
      return this;
    }

    if (intentType === "ft_withdraw") {
      if (!rawIntent.token || !rawIntent.receiver_id || !rawIntent.amount) {
        throw new Error("ft_withdraw intent must have 'token', 'receiver_id', and 'amount' fields");
      }

      const token = `nep141:${rawIntent.token}` as OmniToken;
      return this.withdraw({
        amount: BigInt(rawIntent.amount),
        receiver: rawIntent.receiver_id,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
        token,
      });
    }

    if (intentType === "auth_call") {
      if (!rawIntent.contract_id || !rawIntent.msg || !rawIntent.attached_deposit || !rawIntent.min_gas) {
        throw new Error("auth_call intent must have 'contract_id', 'msg', 'attached_deposit', and 'min_gas' fields");
      }

      return this.authCall({
        contractId: rawIntent.contract_id,
        msg: rawIntent.msg,
        attachNear: BigInt(rawIntent.attached_deposit),
        tgas: Number(BigInt(rawIntent.min_gas) / TGAS),
      });
    }

    throw new Error(`Unsupported intent type: ${intentType}`);
  }

  withdraw(args: { token: OmniToken; amount: number | bigint; receiver: string; memo?: string; msg?: string; tgas?: number }) {
    const omniToken = tokens.get(args.token);
    const amount = (typeof args.amount === "number" ? omniToken.int(args.amount) : args.amount).toString();
    const [standart, ...tokenParts] = args.token.split(":");
    this.addNeed(args.token, BigInt(amount));

    if (standart === "nep245") {
      const mtContract = tokenParts[0];
      const tokenId = tokenParts.slice(1).join(":");
      const intent: MtWithdrawIntent = {
        intent: "mt_withdraw",
        amounts: [amount],
        receiver_id: args.receiver,
        token_ids: [tokenId],
        token: mtContract,
        memo: args.memo,
        msg: args.msg,
        min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
      };

      this.intents.push(intent);
      return this;
    }

    if (standart === "nep141") {
      const intent: FtWithdrawIntent = {
        intent: "ft_withdraw",
        receiver_id: args.receiver,
        token: tokenParts.join(":"),
        amount: amount,
        memo: args.memo,
        msg: args.msg,
      };

      this.intents.push(intent);
      return this;
    }

    throw new Error(`Unsupported token: ${args.token}`);
  }

  attachHashes(hashes: string[]) {
    this.hashes.push(...hashes);
    return this;
  }

  attachWallet(wallet: OmniWallet) {
    this.signer = wallet;
    return this;
  }

  attachDeadline(deadline: Date) {
    this.deadline = deadline;
    return this;
  }

  attachNonce(nonce: Uint8Array) {
    this.nonce = nonce;
    return this;
  }

  attachTimeout(seconds: number) {
    this.deadline = new Date(Date.now() + seconds * 1000);
    return this;
  }

  attachSeed(seed: string) {
    this.nonce = new Uint8Array(sha256(new TextEncoder().encode(seed))).slice(0, 32);
    return this;
  }

  take(token: OmniToken, amount: number | bigint) {
    const intAmount = typeof amount === "number" ? tokens.get(token).int(amount) : amount;

    this.addNeed(token, intAmount);
    const tokenDiff = this.intents.find((intent) => intent.intent === "token_diff");

    if (tokenDiff) tokenDiff.diff[token.toString()] = intAmount.toString();
    else this.intents.push({ intent: "token_diff", diff: { [token.toString()]: intAmount.toString() } });
    return this;
  }

  give(token: OmniToken, amount: number | bigint) {
    const intAmount = typeof amount === "number" ? tokens.get(token).int(amount) : amount;

    this.addNeed(token, -intAmount);
    const tokenDiff = this.intents.find((intent) => intent.intent === "token_diff");

    if (tokenDiff) tokenDiff.diff[token.toString()] = (-intAmount).toString();
    else this.intents.push({ intent: "token_diff", diff: { [token.toString()]: (-intAmount).toString() } });
    return this;
  }

  async signRaw({ ed25519PrivateKey, intentsAddress, checkTokens }: { ed25519PrivateKey: Uint8Array; intentsAddress?: string; checkTokens?: boolean }) {
    if (checkTokens) {
      await this.checkRequiredTokens();
    }

    const publicKey = ed25519.getPublicKey(ed25519PrivateKey);
    const nonce = new Uint8Array(this.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: this.deadline ? new Date(this.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      nonce: base64.encode(nonce),
      verifying_contract: "intents.near",
      signer_id: intentsAddress || hex.encode(publicKey).toLowerCase(),
      intents: this.intents,
    });

    return {
      signature: `ed25519:${base58.encode(ed25519.sign(message, ed25519PrivateKey))}`,
      public_key: `ed25519:${base58.encode(publicKey)}`,
      standard: "raw_ed25519",
      payload: message,
    };
  }

  async attachCommitment(commitment: Record<string, any>) {
    this.commitments.push(commitment);
    return this;
  }

  async attachSigner(signer: OmniWallet | { ed25519PrivateKey: Uint8Array; omniAddress?: string }) {
    this.signer = signer;
    return this;
  }

  async checkRequiredTokens() {
    if (this.wibe3 == null) return;
    for (const [token, needAmount] of this.need.entries()) {
      if (needAmount <= 0n) continue;
      await this.wibe3.requestToken(token, needAmount);
    }
  }

  async sign(params = { checkTokens: true }) {
    const signer = this.signer;
    if (!signer) throw new Error("No signer attached");
    if (!signer.omniAddress) throw new Error("No omni address");

    if ("ed25519PrivateKey" in signer) {
      return await this.signRaw({
        ed25519PrivateKey: signer.ed25519PrivateKey,
        intentsAddress: signer.omniAddress,
        checkTokens: params.checkTokens,
      });
    }

    if (params.checkTokens) {
      await this.checkRequiredTokens();
    }

    return await signer.signIntents(this.intents, {
      deadline: this.deadline ? +this.deadline : undefined,
      nonce: this.nonce,
    });
  }

  async simulate(params = { checkTokens: true }) {
    const signed = await this.sign(params);
    return await Intents.simulateIntents([signed]);
  }

  async execute(params = { checkTokens: true }) {
    const signed = await this.sign(params);
    const hash = await Intents.publishSignedIntents([...this.commitments, signed], this.hashes);
    await rpc.waitTransactionResult(hash, "intents.near");
    return hash;
  }

  static async publishSignedIntents(signed: Record<string, any>[], hashes: string[] = []): Promise<string> {
    const res = await fetch("https://api0.herewallet.app/api/v1/evm/intent-solver", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        params: [{ signed_datas: signed, quote_hashes: hashes }],
        method: "publish_intents",
        id: "dontcare",
        jsonrpc: "2.0",
      }),
    });

    const { result } = await res.json();
    if (result.status === "FAILED") throw result.reason;
    const intentResult = result.intent_hashes[0];

    const getStatus = async () => {
      const statusRes = await fetch("https://api0.herewallet.app/api/v1/evm/intent-solver", {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          params: [{ intent_hash: intentResult }],
          method: "get_status",
          id: "dontcare",
          jsonrpc: "2.0",
        }),
      });

      const { result } = await statusRes.json();
      return result;
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

  static async simulateIntents(signed: Record<string, any>[]) {
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
