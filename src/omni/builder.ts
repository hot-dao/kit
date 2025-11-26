import { omni } from "./exchange";
import { Intents } from "./Intents";
import { OmniWallet } from "./OmniWallet";
import { OmniToken } from "./config";
import { TGAS } from "./fee";
import { HotConnector } from "../HotConnector";

export interface TransferIntent {
  intent: "transfer";
  tokens: Record<string, string>;
  receiver_id: string;
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

class IntentsBuilder {
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

  transfer(args: { recipient: string; token: OmniToken; amount: number | bigint }) {
    const omniToken = omni.omni(args.token);
    const amount = (typeof args.amount === "number" ? omniToken.int(args.amount) : args.amount).toString();
    const intent: TransferIntent = {
      tokens: { [omniToken.omniAddress]: amount },
      receiver_id: args.recipient.toLowerCase(),
      intent: "transfer",
    };

    this.addNeed(args.token, BigInt(amount));
    this.intents.push(intent);
    return this;
  }

  tokenDiff(args: Record<OmniToken, bigint | number>) {
    const parse = (token: OmniToken, amount: bigint | number): [string, string] => {
      if (typeof amount === "number") return [token.toString(), omni.omni(token).int(amount).toString()];
      return [token.toString(), amount.toString()];
    };

    const intent: TokenDiffIntent = {
      token_diff: Object.fromEntries(Object.entries(args).map(([token, amount]) => parse(token as OmniToken, amount))),
      intent: "token_diff",
    };

    this.intents.push(intent);
    return this;
  }

  withdraw(args: { token: OmniToken; amount: number | bigint; receiver: string; memo?: string; msg?: string }) {
    const omniToken = omni.omni(args.token);
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

  async execute(args?: { connector?: HotConnector }) {
    if (!this.signer) throw new Error("No signer attached");

    console.log(args);

    if (args?.connector) {
      const balances = await this.signer.getAssets();
      for (const token of this.need.keys()) {
        const amount = this.need.get(token) || 0n;
        const balance = balances[token] || 0n;
        if (amount === 0n) continue;

        if (balance < amount) {
          const need = amount - balance;
          const ft = omni.omni(token as OmniToken);
          const popup = await args.connector.deposit(token as any, Number(ft.float(need)));
          await this.signer.waitUntilBalance({ [token]: amount }, this.signer.omniAddress);
          args.connector.fetchTokens(this.signer);
          popup.close();
        }
      }
    }

    const signed = await this.signer.signIntents(this.intents, { nonce: this.nonce, deadline: this.deadline ? +this.deadline : undefined });
    return await Intents.publishSignedIntents([signed], this.hashes);
  }
}

export default IntentsBuilder;
