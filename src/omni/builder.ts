import { sha256 } from "@noble/hashes/sha2.js";

import { HotConnector } from "../HotConnector";
import { Intents } from "./Intents";
import { OmniWallet } from "./OmniWallet";
import { OmniToken } from "./config";
import { TGAS } from "./fee";

export interface TransferIntent {
  intent: "transfer";
  tokens: Record<string, string>;
  receiver_id: string;
  msg?: string;
  min_gas?: string;
}

export interface TokenDiffIntent {
  intent: "token_diff";
  token_diff: Record<string, string>;
}

export interface MtWithdrawIntent {
  intent: "mt_withdraw";
  amounts: string[];
  receiver_id: string;
  token_ids: string[];
  token: string;
  memo?: string;
  msg?: string;
  min_gas?: string;
}

export interface FtWithdrawIntent {
  intent: "ft_withdraw";
  memo?: string;
  receiver_id: string;
  token: string;
  amount: string;
  msg?: string;
}

export interface AuthCallIntent {
  min_gas: string;
  attached_deposit: string;
  contract_id: string;
  msg: string;
  intent: "auth_call";
}

export interface Commitment {
  deadline: string;
  signer_id: string;
  intents: TransferIntent | MtWithdrawIntent | FtWithdrawIntent | TokenDiffIntent | AuthCallIntent[];
}

class IntentsBuilder {
  constructor(readonly wibe3: HotConnector) {}

  hashes: string[] = [];
  intents: (TransferIntent | MtWithdrawIntent | FtWithdrawIntent | TokenDiffIntent | AuthCallIntent)[] = [];
  nonce?: Uint8Array;
  deadline?: Date;
  signer?: OmniWallet;

  need = new Map<OmniToken, bigint>();
  addNeed(token: OmniToken, amount: bigint) {
    if (!this.need.has(token)) this.need.set(token, 0n);
    this.need.set(token, this.need.get(token)! + amount);
    return this;
  }

  authCall(args: { contractId: string; msg: string; attachNear: bigint; tgas: number }) {
    this.addNeed(OmniToken.NEAR, args.attachNear);
    this.intents.push({
      intent: "auth_call",
      min_gas: (BigInt(args.tgas) * TGAS).toString(),
      attached_deposit: args.attachNear.toString(),
      contract_id: args.contractId,
      msg: args.msg,
    });

    return this;
  }

  transfer(args: { recipient: string; token: OmniToken; amount: number | bigint; msg?: string; tgas?: number }) {
    const omniToken = this.wibe3.omni(args.token);
    const amount = (typeof args.amount === "number" ? omniToken.int(args.amount) : args.amount).toString();
    const intent: TransferIntent = {
      tokens: { [omniToken.omniAddress]: amount },
      receiver_id: args.recipient.toLowerCase(),
      intent: "transfer",
      msg: args.msg,
      min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
    };

    this.addNeed(args.token, BigInt(amount));
    this.intents.push(intent);
    return this;
  }

  batchTransfer(args: { recipient: string; tokens: Record<OmniToken, number | bigint>; msg?: string; tgas?: number }) {
    const tokens: Record<string, string> = {};
    for (const [token, amount] of Object.entries(args.tokens)) {
      const omniToken = this.wibe3.omni(token as OmniToken);
      const amountStr = typeof amount === "number" ? omniToken.int(amount).toString() : amount.toString();
      tokens[omniToken.omniAddress] = amountStr;
      this.addNeed(token as OmniToken, BigInt(amountStr));
    }

    const intent: TransferIntent = {
      intent: "transfer",
      receiver_id: args.recipient.toLowerCase(),
      min_gas: args.tgas ? (BigInt(args.tgas) * TGAS).toString() : undefined,
      msg: args.msg,
      tokens,
    };

    this.intents.push(intent);
    return this;
  }

  tokenDiff(args: Record<OmniToken, bigint | number>) {
    const parse = (token: OmniToken, amount: bigint | number): [string, string] => {
      if (typeof amount === "number") return [token.toString(), this.wibe3.omni(token).int(amount).toString()];
      return [token.toString(), amount.toString()];
    };

    const intent: TokenDiffIntent = {
      token_diff: Object.fromEntries(Object.entries(args).map(([token, amount]) => parse(token as OmniToken, amount))),
      intent: "token_diff",
    };

    for (const [token, amountStr] of Object.entries(intent.token_diff)) {
      const amount = BigInt(amountStr);
      if (amount < 0n) {
        const tokenKey = token as OmniToken;
        this.addNeed(tokenKey, -amount);
      }
    }

    this.intents.push(intent);
    return this;
  }

  withdraw(args: { token: OmniToken; amount: number | bigint; receiver: string; memo?: string; msg?: string; tgas?: number }) {
    const omniToken = this.wibe3.omni(args.token);
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

  addRaw(rawIntent: Record<string, any>) {
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
        token,
        amount: BigInt(rawIntent.amount),
        receiver: rawIntent.receiver_id,
        memo: rawIntent.memo,
        msg: rawIntent.msg,
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

  async sign(requestToken: boolean = false) {
    const signer = this.signer;
    if (!signer) throw new Error("No signer attached");
    if (!signer.omniAddress) throw new Error("No omni address");

    if (requestToken && this.need.size > 0) {
      for (const [token, needAmount] of this.need.entries()) {
        console.log("requestToken", token, needAmount);
        await this.wibe3.requestToken(token, needAmount);
      }
    }

    return await signer.signIntents(this.intents, { nonce: this.nonce, deadline: this.deadline ? +this.deadline : undefined });
  }

  async execute() {
    const signed = await this.sign();
    const hash = await Intents.publishSignedIntents([signed], this.hashes);
    await Intents.waitTransactionResult(hash, "intents.near");
    return hash;
  }
}

export default IntentsBuilder;
