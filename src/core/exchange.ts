import { GetExecutionStatusResponse, OneClickService, ApiError, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { utils } from "@hot-labs/omni-sdk";
import { hex } from "@scure/base";

import { chains, Network, OmniToken, WalletType } from "./chains";
import { createHotBridge, ReviewFee } from "./bridge";
import { OmniWallet } from "./OmniWallet";
import { Recipient } from "./recipient";
import { ILogger } from "./telemetry";
import { formatter } from "./utils";
import { tokens } from "./tokens";
import { Token } from "./token";

import StellarWallet from "../stellar/wallet";
import NearWallet from "../near/wallet";

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
  amountIn: bigint;
  amountOut: bigint;
  minAmountOut: bigint;
  slippage: number;
  fee: ReviewFee | null;
  qoute: QuoteResponse["quote"] | "withdraw" | "deposit";
  status: "pending" | "success" | "failed";
  statusMessage: string | null;
  sender?: OmniWallet | "qr";
  refund?: OmniWallet;
  recipient?: OmniWallet | Recipient;
  logger?: ILogger;
  from: Token;
  to: Token;
};

export interface BridgeRequest {
  refund?: OmniWallet;
  sender?: OmniWallet | "qr";
  type?: "exactIn" | "exactOut";
  logger?: ILogger;
  recipient?: Recipient;
  slippage: number;
  amount: bigint;
  from: Token;
  to: Token;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Exchange {
  readonly bridge = createHotBridge();

  async getToken(chain: number, address: string): Promise<string | null> {
    if (chain === Network.Omni || chain === Network.HotCraft) return address;
    const tokensList = await tokens.getTokens();
    const token = tokensList.find((t) => {
      if (t.chain !== chain) return false;
      if (t.address?.toLowerCase() === address.toLowerCase()) return true;
      if (address === "native" && t.address == "native") return true;
      if (address === "native" && t.address == "wrap.near") return true;
      return false;
    });

    return token?.omniAddress || null;
  }

  async deposit(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: Recipient; logger?: ILogger }) {
    let { sender, token, amount, recipient, logger } = args;
    logger?.log("Sending deposit transaction");

    const balance = await sender.fetchBalance(token.chain, token.address);
    amount = formatter.bigIntMin(amount, balance);

    if (token.isOmni) {
      return await sender.transfer({ amount: amount, token: token, receiver: recipient.omniAddress });
    }

    if (token.type === WalletType.COSMOS && sender.type === WalletType.COSMOS) {
      const cosmosBridge = await this.bridge.cosmos();
      const hash = await cosmosBridge.deposit({
        sendTransaction: async (tx) => sender.sendTransaction(tx),
        senderPublicKey: hex.decode(sender.publicKey!),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      logger?.log("Waiting for deposit");
      const deposit = await this.bridge.waitPendingDeposit(token.chain, hash, recipient.omniAddress);
      logger?.log("Finishing deposit");
      await this.bridge.finishDeposit(deposit);
      logger?.log("Deposit finished");
      return;
    }

    if (token.type === WalletType.EVM && sender.type === WalletType.EVM) {
      const hash = await this.bridge.evm.deposit({
        sendTransaction: async (tx) => sender.sendTransaction(tx),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      if (!hash) throw new Error("Failed to deposit");
      logger?.log("Waiting for deposit");
      const deposit = await this.bridge.waitPendingDeposit(token.chain, hash, recipient.omniAddress);
      logger?.log("Finishing deposit");
      await this.bridge.finishDeposit(deposit);
      logger?.log("Deposit finished");
      return;
    }

    if (token.type === WalletType.NEAR && sender.type === WalletType.NEAR) {
      return await this.bridge.near.deposit({
        sendTransaction: async (tx: any) => sender.sendTransaction(tx),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        amount: amount,
      });
    }

    throw new Error("Unsupported token");
  }

  async withdraw(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: OmniWallet | Recipient; logger?: ILogger }) {
    const { sender, token, recipient, logger } = args;

    if (recipient.type === WalletType.NEAR && token.type === WalletType.NEAR && recipient instanceof NearWallet) {
      logger?.log("Registering NEAR token");
      await recipient.registerToken(token.originalAddress);
    }

    const balance = await sender.fetchBalance(token.chain, token.address);
    const amount = formatter.bigIntMin(args.amount, balance);

    logger?.log("Withdrawing token");
    await this.bridge.withdrawToken({
      signIntents: async (intents) => sender.signIntents(intents),
      intentAccount: sender.omniAddress,
      receiver: recipient.address,
      token: token.originalAddress,
      chain: token.originalChain,
      adjustMax: true,
      gasless: true,
      amount: amount,
    });
  }

  async withdrawFee(request: BridgeRequest) {
    if (request.recipient == null) return 0n;
    if (request.sender === "qr") throw new Error("Sender is QR");
    if (request.to.chain === Network.Near || request.to.isOmni) return 0n;
    const gaslessFee = await this.bridge.getGaslessWithdrawFee({
      receiver: request.recipient.address,
      token: request.to.address,
      chain: request.to.chain,
    });

    if (gaslessFee.gasPrice === 0n) return 0n;
    if (request.to.address === "native") return 0n;

    // if withdraw token is not native, we need to swap a bit of it to native to cover the withdraw fee
    const swap = await this.bridge.buildSwapExectOutIntent({
      intentFrom: utils.toOmniIntent(request.to.chain, request.to.address),
      intentTo: utils.toOmniIntent(request.to.chain, "native"),
      amountOut: gaslessFee.gasPrice,
    });

    // if swap is successful and the amount out is greater than the amount in, we need to subtract the amount in from the amount out
    return BigInt(swap.amount_in);
  }

  isDirectDeposit(from: Token, to: Token) {
    const directChains = [Network.Near, Network.Omni, Network.HotCraft, Network.Juno, Network.Gonka, Network.ADI];
    return directChains.includes(from.chain) && to.isOmni && from.omniAddress === to.omniAddress;
  }

  isDirectWithdraw(from: Token, to: Token) {
    const directChains = [Network.Near, Network.Omni, Network.HotCraft, Network.Juno, Network.Gonka, Network.ADI];
    return directChains.includes(to.chain) && from.isOmni && from.omniAddress === to.omniAddress;
  }

  async reviewSwap(request: BridgeRequest): Promise<BridgeReview> {
    const { sender, refund, from, to, amount, recipient, slippage, type, logger } = request;

    const deadlineTime = 5 * 60 * 1000;
    const deadline = new Date(Date.now() + deadlineTime).toISOString();
    const noFee = from.symbol === to.symbol || (from.symbol.toLowerCase().includes("usd") && to.symbol.toLowerCase().includes("usd"));

    if (sender !== "qr" && this.isDirectDeposit(from, to)) {
      let fee: ReviewFee | null = null;
      if (sender != null) {
        fee = await this.bridge.getDepositFee({
          intentAccount: sender.omniAddress,
          sender: sender.address,
          token: from.address,
          chain: from.chain,
          amount: amount,
        });
      }

      return {
        from: from,
        to: to,
        minAmountOut: amount,
        sender: sender,
        recipient,
        refund: refund,
        amountIn: amount,
        amountOut: amount,
        slippage: slippage,
        statusMessage: null,
        status: "pending",
        qoute: "deposit",
        logger,
        fee,
      };
    }

    if (sender !== "qr" && this.isDirectWithdraw(from, to)) {
      const fee = await this.withdrawFee(request);
      if (fee >= amount) throw "Withdraw fee is greater than amount";
      return {
        from: from,
        to: to,
        amountIn: amount,
        sender: sender,
        fee: new ReviewFee({ chain: from.chain }),
        amountOut: amount - fee,
        minAmountOut: amount - fee,
        slippage: slippage,
        recipient: recipient,
        statusMessage: null,
        status: "pending",
        qoute: "withdraw",
        refund: refund,
        logger,
      };
    }

    const refundParams = {
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      refundTo: refund?.address || chains.get(from.chain)?.testAddress,
    };

    // Refund to omni wallet if token is not 1-1 mapping or if this token is omni
    if ((refund?.type !== from.type || from.isOmni) && refund != null) {
      if (!refund.omniAddress) throw "Setup refund address";
      refundParams.refundType = QuoteRequest.refundType.INTENTS;
      refundParams.refundTo = refund.omniAddress;
    }

    if (recipient?.type === WalletType.STELLAR) {
      const isTokenActivated = await StellarWallet.isTokenActivated(recipient.address, request.to.address);
      if (!isTokenActivated && !(recipient instanceof StellarWallet)) throw "Token not activated for recipient";
    }

    let qoute: QuoteResponse | null = null;
    try {
      const intentFrom = await this.getToken(from.chain, from.address);
      const intentTo = await this.getToken(to.chain, to.address);

      if (!intentFrom) throw new Error("Unsupported token");
      if (!intentTo) throw new Error("Unsupported token");

      qoute = await OneClickService.getQuote({
        originAsset: intentFrom,
        destinationAsset: intentTo,
        quoteWaitingTimeMs: 3000,
        slippageTolerance: Math.round(slippage * 10_000),
        swapType: type === "exactOut" ? QuoteRequest.swapType.EXACT_OUTPUT : QuoteRequest.swapType.EXACT_INPUT,
        depositType: from.isOmni ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN,
        depositMode: from.chain === Network.Stellar ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
        recipientType: to.isOmni ? QuoteRequest.recipientType.INTENTS : QuoteRequest.recipientType.DESTINATION_CHAIN,
        recipient: (to.isOmni ? recipient?.omniAddress : recipient?.address) || chains.get(to.chain)?.testAddress,
        appFees: noFee ? [] : [{ recipient: "intents.tg", fee: 25 }],
        amount: request.amount.toString(),
        referral: "intents.tg",
        deadline: deadline,
        ...refundParams,
        dry: false,
      });
    } catch (e) {
      console.log({ e });
      if (e instanceof ApiError && e.body.message.includes("Amount is too low")) {
        const minAmount = e.body.message.match(/try at least (\d+)/)?.[1];
        if (minAmount) throw `Minimum amount is ${from.readable(minAmount)} ${from.symbol}`;
        throw "Amount is too low";
      }

      if (e instanceof ApiError && e.body.message.includes("is not valid")) {
        throw "This pair is not supported yet";
      }

      throw e;
    }

    let fee: ReviewFee | null = null;
    if (!request.from.isOmni && sender !== "qr" && sender != null) {
      const amount = BigInt(qoute.quote.amountIn);
      const depositAddress = qoute.quote.depositAddress!;
      fee = await sender.transferFee(request.from, depositAddress, amount).catch(() => null);
    }

    return {
      from: request.from,
      to: request.to,
      minAmountOut: BigInt(qoute.quote.minAmountOut),
      amountIn: BigInt(qoute.quote.amountIn),
      amountOut: BigInt(qoute.quote.amountOut),
      slippage: request.slippage,
      recipient: request.recipient,
      statusMessage: null,
      qoute: qoute.quote,
      status: "pending",
      refund: refund,
      sender: sender,
      fee: fee,
      logger,
    };
  }

  async makeSwap(review: BridgeReview): Promise<{ review: BridgeReview; processing?: () => Promise<BridgeReview> }> {
    const { sender, recipient, logger, refund } = review;
    if (sender == null) throw new Error("Sender is required");
    if (recipient == null) throw new Error("Recipient is required");
    if (refund == null) throw new Error("Refund is required");

    if (review.qoute === "withdraw") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.withdraw({ sender, token: review.to, amount: review.amountIn, recipient, logger });
      if (recipient instanceof OmniWallet) recipient.fetchBalance(review.to.chain, review.to.address);
      if (sender instanceof OmniWallet) sender.fetchBalance(review.from.chain, review.from.address);
      return { review };
    }

    if (review.qoute === "deposit") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.deposit({ sender, token: review.from, amount: review.amountIn, recipient, logger });
      if (recipient instanceof OmniWallet) recipient.fetchBalance(review.to.chain, review.to.address);
      if (sender instanceof OmniWallet) sender.fetchBalance(review.from.chain, review.from.address);
      return { review };
    }

    if (recipient.type === WalletType.STELLAR) {
      const isTokenActivated = await StellarWallet.isTokenActivated(recipient.address, review.to.address);
      if (!isTokenActivated && !(recipient instanceof StellarWallet)) throw "Token not activated for recipient";
      if (!isTokenActivated && recipient instanceof StellarWallet) await recipient.changeTrustline(review.to.address);
    }

    if (sender === "qr") {
      return {
        review,
        processing: async () => {
          if (!(recipient instanceof OmniWallet)) return await this.processing(review);
          const beforeBalance = await recipient.fetchBalance(review.to.chain, review.to.address).catch(() => null);
          if (!beforeBalance) return await this.processing(review);
          return await Promise.race([
            this.waitBalance(review.to, recipient, beforeBalance, review),
            this.processing(review), //
          ]);
        },
      };
    }

    const depositAddress = review.qoute.depositAddress!;
    const hash = await sender.transfer({
      comment: review.qoute.depositMemo,
      gasFee: review.fee ?? undefined,
      receiver: depositAddress,
      amount: review.amountIn,
      token: review.from,
    });

    if (sender instanceof OmniWallet) sender.fetchBalance(review.from.chain, review.from.address);
    OneClickService.submitDepositTx({ txHash: hash, depositAddress }).catch(() => {});

    return {
      review,
      processing: async () => {
        if (!(recipient instanceof OmniWallet)) return await this.processing(review);

        const beforeBalance = await recipient.fetchBalance(review.to.chain, review.to.address).catch(() => null);
        if (!beforeBalance) return await this.processing(review);

        return await Promise.race([
          this.waitBalance(review.to, recipient, beforeBalance, review),
          this.processing(review), //
        ]);
      },
    };
  }

  async waitBalance(to: Token, wallet: OmniWallet, beforeBalance: bigint, review: BridgeReview): Promise<BridgeReview> {
    const afterBalance = await wallet.fetchBalance(to.chain, to.address).catch(() => beforeBalance);
    if (afterBalance > beforeBalance) {
      return {
        ...review,
        amountOut: afterBalance - beforeBalance,
        statusMessage: "Swap successful",
        status: "success",
      };
    }

    await wait(2000);
    return await this.waitBalance(to, wallet, beforeBalance, review);
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
