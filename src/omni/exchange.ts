import { GetExecutionStatusResponse, OneClickService, OpenAPI, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { makeObservable, observable } from "mobx";

import CosmosWallet from "../cosmos/wallet";
import { bridge, Network, OmniToken, WalletType } from "./config";
import { OmniWallet } from "./OmniWallet";
import { defaultTokens } from "./list";
import { ReviewFee } from "./fee";
import { Token } from "./token";

OpenAPI.BASE = "https://1click.chaindefuser.com";
OpenAPI.TOKEN = "";

export class UnsupportedDexError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ReadableDexError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type BridgeReview = {
  from: Token;
  to: Token;
  amountIn: bigint;
  amountOut: bigint;
  slippage: number;
  receiver: string;
  fee: ReviewFee;
  qoute: QuoteResponse["quote"] | "withdraw" | "deposit";
  status: "pending" | "success" | "failed";
  statusMessage: string | null;
};

class Omni {
  public tokens = defaultTokens.flatMap((t: any) => [new Token(t), new Token({ ...t, omni: true })]);

  constructor() {
    makeObservable(this, {
      tokens: observable,
    });
  }

  omni(id: OmniToken): Token {
    return this.tokens.find((t) => t.address === id)!;
  }

  async updateRates() {
    const map = new Map<string, Token>();
    this.tokens.forEach((t) => map.set(t.id, t));
    const tokens = await omni.getTokens();
    tokens.forEach((t: any) => {
      if (map.has(t.id)) map.get(t.id)!.usd = t.usd;
      else this.tokens.push(t);
    });
  }

  async getToken(chain: number, address: string): Promise<string | null> {
    if (chain === Network.Hot) return address;
    const tokens = await this.getTokens();

    const token = tokens.find((t) => {
      if (t.chain !== chain) return false;

      if (chain === Network.Stellar) {
        const issued = t.address === "native" ? Asset.native() : new Asset(t.symbol, t.address);
        return issued.contractId(Networks.PUBLIC) === address;
      }

      if (t.address?.toLowerCase() === address.toLowerCase()) return true;
      if (address === "native" && t.address == "native") return true;
      if (address === "native" && t.address == "wrap.near") return true;
      return false;
    });

    return token?.omniAddress || null;
  }

  async deposit(args: { sender: OmniWallet; token: Token; amount: bigint; receiver: string; onMessage: (message: string) => void }) {
    const { sender, token, amount, receiver, onMessage } = args;
    onMessage("Sending deposit transaction");

    if (token.type === WalletType.COSMOS && sender instanceof CosmosWallet) {
      const cosmosBridge = await bridge.cosmos();
      const hash = await cosmosBridge.deposit({
        sendTransaction: async (tx: any) => sender.sendTransaction(tx),
        senderPublicKey: sender.publicKey!,
        intentAccount: receiver,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      onMessage("Waiting for deposit");
      const deposit = await bridge.waitPendingDeposit(token.chain, hash, receiver);
      onMessage("Finishing deposit");
      await bridge.finishDeposit(deposit);
      onMessage("Deposit finished");
    }

    throw new Error("Unsupported token");
  }

  async withdraw(args: { sender: OmniWallet; token: Token; amount: bigint; receiver: string; onMessage: (message: string) => void }) {
    const { sender, token, amount, receiver, onMessage } = args;
    await bridge.withdrawToken({
      signIntents: async (intents: any) => sender.signIntents(intents),
      intentAccount: sender.omniAddress,
      receiver: receiver,
      token: token.address,
      chain: token.chain,
      gasless: true,
      amount: amount,
    });
  }

  async getTokens(): Promise<Token[]> {
    if (this.tokens.length > 0) return this.tokens;
    const list = await OneClickService.getTokens();
    this.tokens = list.map((t) => new Token(t));
    return this.tokens;
  }

  async reviewSwap(request: { sender: OmniWallet; from: Token; to: Token; amount: bigint; receiver: string; slippage: number; type?: "exactIn" | "exactOut" }): Promise<BridgeReview> {
    const { sender, from, to, amount, receiver, slippage, type } = request;
    const intentFrom = await this.getToken(from.chain, from.address);
    const intentTo = await this.getToken(to.chain, to.address);

    if (!intentFrom) throw new Error("Unsupported token");
    if (!intentTo) throw new Error("Unsupported token");

    const deadlineTime = 20 * 60 * 1000;
    const directChains = [Network.Near, Network.Juno, Network.Gonka];
    const deadline = new Date(Date.now() + deadlineTime).toISOString();
    const noFee = from.symbol === to.symbol;

    if (directChains.includes(from.chain) && to.chain === Network.Hot && from.omniAddress === to.omniAddress) {
      const fee = await bridge.getDepositFee({
        amount: amount,
        token: from.address,
        chain: from.chain,
        sender: sender.address,
        intentAccount: receiver,
      });

      return {
        from: from,
        to: to,
        amountIn: amount,
        amountOut: amount,
        slippage: slippage,
        receiver: receiver,
        statusMessage: null,
        status: "pending",
        qoute: "deposit",
        fee,
      };
    }

    if (directChains.includes(to.chain) && from.chain === Network.Hot && from.omniAddress === to.omniAddress) {
      return {
        from: from,
        to: to,
        amountIn: amount,
        fee: new ReviewFee({ chain: -4 }),
        amountOut: amount,
        slippage: slippage,
        receiver: receiver,
        statusMessage: null,
        status: "pending",
        qoute: "withdraw",
      };
    }

    const qoute = await OneClickService.getQuote({
      originAsset: intentFrom,
      destinationAsset: intentTo,
      slippageTolerance: Math.round(slippage * 10_000),
      swapType: type === "exactIn" ? QuoteRequest.swapType.EXACT_INPUT : QuoteRequest.swapType.EXACT_OUTPUT,
      depositType: from.chain === Network.Hot ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN,
      depositMode: from.chain === Network.Stellar ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
      recipientType: to.chain === Network.Hot ? QuoteRequest.recipientType.INTENTS : QuoteRequest.recipientType.DESTINATION_CHAIN,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN, // : QuoteRequest.refundType.INTENTS,
      refundTo: sender.address,
      appFees: noFee ? [] : [{ recipient: "intents.tg", fee: 25 }],
      amount: request.amount.toString(),
      referral: "intents.tg",
      recipient: request.receiver,
      deadline: deadline,
      dry: false,
    });

    let fee = new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: -4 });
    if (request.from.chain !== Network.Hot) {
      const amount = BigInt(qoute.quote.amountIn);
      const depositAddress = qoute.quote.depositAddress!;
      fee = await request.sender.transferFee(request.from, depositAddress, amount);
    }

    return {
      from: request.from,
      to: request.to,
      amountIn: BigInt(qoute.quote.amountIn),
      amountOut: BigInt(qoute.quote.amountOut),
      slippage: request.slippage,
      receiver: request.receiver,
      statusMessage: null,
      qoute: qoute.quote,
      status: "pending",
      fee: fee,
    };
  }

  async makeSwap(sender: OmniWallet, review: BridgeReview, pending: { log: (message: string) => void }) {
    if (review.qoute === "withdraw") {
      await this.withdraw({ sender, token: review.to, amount: review.amountIn, receiver: review.receiver, onMessage: pending.log });
      return review;
    }

    if (review.qoute === "deposit") {
      await this.deposit({ sender, token: review.from, amount: review.amountIn, receiver: review.receiver, onMessage: pending.log });
      return review;
    }

    const depositAddress = review.qoute.depositAddress!;
    const hash = await sender.transfer({
      receiver: depositAddress,
      amount: review.amountIn,
      comment: review.qoute.depositMemo,
      token: review.from,
      gasFee: review.fee,
    });

    pending.log("Submitting tx");
    await OneClickService.submitDepositTx({ txHash: hash, depositAddress }).catch(() => {});

    pending.log("Checking status");
    return await this.processing(review);
  }

  getMessage(status: GetExecutionStatusResponse.status): string | null {
    if (status === GetExecutionStatusResponse.status.PENDING_DEPOSIT) return "Waiting for deposit";
    if (status === GetExecutionStatusResponse.status.INCOMPLETE_DEPOSIT) return "Incomplete deposit";
    if (status === GetExecutionStatusResponse.status.KNOWN_DEPOSIT_TX) return "Known deposit tx";
    if (status === GetExecutionStatusResponse.status.PROCESSING) return "Processing swap";
    if (status === GetExecutionStatusResponse.status.SUCCESS) return "Swap successful";
    if (status === GetExecutionStatusResponse.status.FAILED) return "Swap failed";
    if (status === GetExecutionStatusResponse.status.REFUNDED) return "Swap refunded";
    return null;
  }

  async checkStatus(review: BridgeReview) {
    if (review.qoute === "deposit" || review.qoute === "withdraw") return;
    const status = await OneClickService.getExecutionStatus(review.qoute.depositAddress!, review.qoute.depositMemo);
    const message = this.getMessage(status.status);

    let state: "pending" | "success" | "failed" = "pending";
    if (status.status === GetExecutionStatusResponse.status.SUCCESS) state = "success";
    if (status.status === GetExecutionStatusResponse.status.FAILED) state = "failed";
    if (status.status === GetExecutionStatusResponse.status.REFUNDED) state = "failed";

    if (status.swapDetails.amountOut) review.amountOut = BigInt(status.swapDetails.amountOut);
    review.statusMessage = message;
    review.status = state;
    return review;
  }

  async processing(review: BridgeReview, interval = 3000) {
    while (true) {
      await this.checkStatus(review);
      if (review.statusMessage) console.log(review.statusMessage);
      if (review.status === "success") return review;
      if (review.status === "failed") throw review.statusMessage || "Bridge failed";
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

export const omni = new Omni();
