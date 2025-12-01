import { GetExecutionStatusResponse, OneClickService, OpenAPI, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { makeObservable, observable } from "mobx";
import { utils } from "@hot-labs/omni-sdk";

import NearWallet from "../near/wallet";
import CosmosWallet from "../cosmos/wallet";
import { HotConnector } from "../HotConnector";
import StellarWallet from "../stellar/wallet";

import { bridge, Network, OmniToken, WalletType } from "./config";
import { Recipient } from "./recipient";
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
  sender: OmniWallet | "qr";
  recipient: Recipient;
  from: Token;
  to: Token;
  amountIn: bigint;
  amountOut: bigint;
  slippage: number;
  fee: ReviewFee | null;
  qoute: QuoteResponse["quote"] | "withdraw" | "deposit";
  status: "pending" | "success" | "failed";
  statusMessage: string | null;
};

interface BridgeRequest {
  refund: OmniWallet;
  sender: OmniWallet | "qr";
  from: Token;
  to: Token;
  amount: bigint;
  recipient: Recipient;
  slippage: number;
  type?: "exactIn" | "exactOut";
}

export class Exchange {
  public tokens = defaultTokens.flatMap((t: any) => [new Token(t), new Token({ ...t, omni: true })]);

  constructor(readonly wibe3: HotConnector) {
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
    const tokens = await this.getTokens();
    tokens.forEach((t) => {
      if (map.has(t.id)) map.get(t.id)!.usd = t.usd;
      else this.tokens.push(t);
    });
  }

  async getToken(chain: number, address: string): Promise<string | null> {
    if (chain === Network.Hot) return address;
    const tokens = await this.getTokens();

    const token = tokens.find((t) => {
      if (t.chain !== chain) return false;
      if (t.address?.toLowerCase() === address.toLowerCase()) return true;
      if (address === "native" && t.address == "native") return true;
      if (address === "native" && t.address == "wrap.near") return true;
      return false;
    });

    return token?.omniAddress || null;
  }

  async deposit(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: Recipient; onMessage: (message: string) => void }) {
    const { sender, token, amount, recipient, onMessage } = args;
    onMessage("Sending deposit transaction");

    if (token.type === WalletType.COSMOS && sender instanceof CosmosWallet) {
      const cosmosBridge = await bridge.cosmos();
      const hash = await cosmosBridge.deposit({
        sendTransaction: async (tx) => sender.sendTransaction(tx),
        senderPublicKey: sender.publicKey!,
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      onMessage("Waiting for deposit");
      const deposit = await bridge.waitPendingDeposit(token.chain, hash, recipient.omniAddress);
      onMessage("Finishing deposit");
      await bridge.finishDeposit(deposit);
      onMessage("Deposit finished");
      return;
    }

    if (token.type === WalletType.NEAR && sender instanceof NearWallet) {
      return await bridge.near.deposit({
        sendTransaction: async (tx: any) => sender.sendTransaction(tx),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        amount: amount,
      });
    }

    throw new Error("Unsupported token");
  }

  async withdraw(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: Recipient }) {
    const { sender, token, amount, recipient } = args;
    await bridge.withdrawToken({
      signIntents: async (intents) => sender.signIntents(intents),
      intentAccount: sender.omniAddress,
      receiver: recipient.omniAddress,
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

  async withdrawFee(request: BridgeRequest) {
    if (request.sender === "qr") throw new Error("Sender is QR");
    if (request.to.chain === Network.Near || request.to.chain === Network.Hot) return 0n;
    const gaslessFee = await bridge.getGaslessWithdrawFee({
      receiver: request.recipient.address,
      token: request.to.address,
      chain: request.to.chain,
    });

    if (gaslessFee.gasPrice === 0n) return 0n;
    if (request.to.address === "native") return 0n;

    // if withdraw token is not native, we need to swap a bit of it to native to cover the withdraw fee
    const swap = await bridge.buildSwapExectOutIntent({
      intentAccount: request.sender.omniAddress,
      intentFrom: utils.toOmniIntent(request.to.chain, request.to.address),
      intentTo: utils.toOmniIntent(request.to.chain, "native"),
      amountOut: gaslessFee.gasPrice,
    });

    // if swap is successful and the amount out is greater than the amount in, we need to subtract the amount in from the amount out
    return BigInt(swap.amount_in);
  }

  async reviewSwap(request: BridgeRequest): Promise<BridgeReview> {
    const { sender, refund, from, to, amount, recipient, slippage, type } = request;
    const intentFrom = await this.getToken(from.chain, from.address);
    const intentTo = await this.getToken(to.chain, to.address);

    if (!intentFrom) throw new Error("Unsupported token");
    if (!intentTo) throw new Error("Unsupported token");

    const deadlineTime = 20 * 60 * 1000;
    const directChains = [Network.Near, Network.Juno, Network.Gonka];
    const deadline = new Date(Date.now() + deadlineTime).toISOString();
    const noFee = from.symbol === to.symbol;

    if (sender !== "qr" && directChains.includes(from.chain) && to.chain === Network.Hot && from.omniAddress === to.omniAddress) {
      const fee = await bridge.getDepositFee({
        intentAccount: sender.omniAddress,
        sender: sender.address,
        token: from.address,
        chain: from.chain,
        amount: amount,
      });

      return {
        from: from,
        to: to,
        sender: sender,
        recipient,
        amountIn: amount,
        amountOut: amount,
        slippage: slippage,
        statusMessage: null,
        status: "pending",
        qoute: "deposit",
        fee,
      };
    }

    if (sender !== "qr" && directChains.includes(to.chain) && from.chain === Network.Hot && from.omniAddress === to.omniAddress) {
      const fee = await this.withdrawFee(request);
      if (fee >= amount) throw "Withdraw fee is greater than amount";
      return {
        from: from,
        to: to,
        amountIn: amount,
        sender: sender,
        fee: new ReviewFee({ chain: -4 }),
        amountOut: amount - fee,
        slippage: slippage,
        recipient: recipient,
        statusMessage: null,
        status: "pending",
        qoute: "withdraw",
      };
    }

    const refundParams = { refundType: QuoteRequest.refundType.ORIGIN_CHAIN, refundTo: refund.address };
    if (refund.type !== from.type) {
      if (!refund.omniAddress) throw "Setup refund address";
      refundParams.refundType = QuoteRequest.refundType.INTENTS;
      refundParams.refundTo = refund.omniAddress;
    }

    if (recipient.type === WalletType.STELLAR) {
      const isTokenActivated = await StellarWallet.isTokenActivated(to.address);
      const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
      if (!isTokenActivated && !recipientWallet) throw "Token not activated for recipient";
    }

    const qoute = await OneClickService.getQuote({
      originAsset: intentFrom,
      destinationAsset: intentTo,
      slippageTolerance: Math.round(slippage * 10_000),
      swapType: type === "exactIn" ? QuoteRequest.swapType.EXACT_INPUT : QuoteRequest.swapType.EXACT_OUTPUT,
      depositType: from.chain === Network.Hot ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN,
      depositMode: from.chain === Network.Stellar ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
      recipientType: to.chain === Network.Hot ? QuoteRequest.recipientType.INTENTS : QuoteRequest.recipientType.DESTINATION_CHAIN,
      recipient: to.chain === Network.Hot ? recipient.omniAddress : recipient.address,
      appFees: noFee ? [] : [{ recipient: "intents.tg", fee: 25 }],
      amount: request.amount.toString(),
      referral: "intents.tg",
      deadline: deadline,
      ...refundParams,
      dry: false,
    });

    let fee: ReviewFee | null = null;
    if (request.from.chain !== Network.Hot && sender !== "qr") {
      const amount = BigInt(qoute.quote.amountIn);
      const depositAddress = qoute.quote.depositAddress!;
      fee = await sender.transferFee(request.from, depositAddress, amount).catch(() => null);
    }

    return {
      from: request.from,
      to: request.to,
      amountIn: BigInt(qoute.quote.amountIn),
      amountOut: BigInt(qoute.quote.amountOut),
      slippage: request.slippage,
      recipient: request.recipient,
      statusMessage: null,
      qoute: qoute.quote,
      status: "pending",
      sender: sender,
      fee: fee,
    };
  }

  async makeSwap(review: BridgeReview, pending: { log: (message: string) => void }) {
    const { sender, recipient } = review;

    if (review.qoute === "withdraw") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.withdraw({ sender, token: review.to, amount: review.amountIn, recipient });
      this.wibe3.fetchToken(review.from, sender);

      const recipientWallet = sender.connector.wibe3.wallets.find((w) => w.address === recipient.address);
      if (recipientWallet) this.wibe3.fetchToken(review.to, recipientWallet);
      return review;
    }

    if (review.qoute === "deposit") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.deposit({ sender, token: review.from, amount: review.amountIn, recipient, onMessage: pending.log });
      this.wibe3.fetchToken(review.from, sender);

      const recipientWallet = sender.connector.wibe3.wallets.find((w) => w.address === recipient.address);
      if (recipientWallet) sender.connector.wibe3.fetchToken(review.to, recipientWallet);
      return review;
    }

    if (sender !== "qr") {
      if (recipient.type === WalletType.STELLAR) {
        const isTokenActivated = await StellarWallet.isTokenActivated(review.to.address);
        const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
        if (!isTokenActivated && !recipientWallet) throw "Token not activated for recipient";
        if (!isTokenActivated && recipientWallet instanceof StellarWallet) {
          await recipientWallet.changeTrustline(review.to.address);
        }
      }

      const depositAddress = review.qoute.depositAddress!;
      let hash = "";
      if (review.from.chain === Network.Hot) {
        hash = await sender.intents
          .transfer({
            amount: review.amountIn,
            token: review.from.address as OmniToken,
            recipient: depositAddress,
          })
          .execute();
      } else {
        hash = await sender.transfer({
          receiver: depositAddress,
          amount: review.amountIn,
          comment: review.qoute.depositMemo,
          token: review.from,
          gasFee: review.fee ?? undefined,
        });
      }

      pending.log("Submitting tx");
      this.wibe3.fetchToken(review.from, sender);
      await OneClickService.submitDepositTx({ txHash: hash, depositAddress }).catch(() => {});
    }

    pending.log("Checking status");
    const result = await this.processing(review);

    if (sender !== "qr") this.wibe3.fetchToken(review.to, sender);
    const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
    if (recipientWallet) this.wibe3.fetchToken(review.to, recipientWallet);
    return result;
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
    while (review.status === "pending") {
      await this.checkStatus(review);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    if (review.status === "success") return review;
    if (review.status === "failed") throw review.statusMessage || "Bridge failed";
    throw new Error("Unknown status");
  }
}
