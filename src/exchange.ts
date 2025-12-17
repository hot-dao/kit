import { GetExecutionStatusResponse, OneClickService, ApiError, OpenAPI, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { utils } from "@hot-labs/omni-sdk";
import { hex } from "@scure/base";

import { Network, OmniToken, WalletType } from "./core/chains";
import { ReviewFee } from "./core/bridge";
import { Recipient } from "./core/recipient";
import { tokens } from "./core/tokens";
import { Token } from "./core/token";

import StellarWallet from "./stellar/wallet";
import { HotConnector } from "./HotConnector";
import { OmniWallet } from "./OmniWallet";
import { formatter } from "./core";

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
  slippage: number;
  fee: ReviewFee | null;
  qoute: QuoteResponse["quote"] | "withdraw" | "deposit";
  status: "pending" | "success" | "failed";
  statusMessage: string | null;
  sender: OmniWallet | "qr";
  recipient: Recipient;
  from: Token;
  to: Token;
};

interface BridgeRequest {
  refund: OmniWallet;
  sender: OmniWallet | "qr";
  type?: "exactIn" | "exactOut";
  recipient: Recipient;
  slippage: number;
  amount: bigint;
  from: Token;
  to: Token;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Exchange {
  constructor(readonly wibe3: HotConnector) {
    // OpenAPI.BASE = api.getOneClickApiUrl();
    // OpenAPI.HEADERS = { "api-key": api.apiKey };
  }

  async getToken(chain: number, address: string): Promise<string | null> {
    if (chain === Network.Hot) return address;
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

  async deposit(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: Recipient; onMessage: (message: string) => void }) {
    let { sender, token, amount, recipient, onMessage } = args;
    onMessage("Sending deposit transaction");

    const balance = await this.wibe3.fetchToken(token, sender);
    amount = formatter.bigIntMin(amount, balance);

    if (token.type === WalletType.COSMOS && this.wibe3.isCosmosWallet(sender)) {
      const cosmosBridge = await this.wibe3.hotBridge.cosmos();
      const hash = await cosmosBridge.deposit({
        sendTransaction: async (tx) => sender.sendTransaction(tx),
        senderPublicKey: hex.decode(sender.publicKey!),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      onMessage("Waiting for deposit");
      const deposit = await this.wibe3.hotBridge.waitPendingDeposit(token.chain, hash, recipient.omniAddress);
      onMessage("Finishing deposit");
      await this.wibe3.hotBridge.finishDeposit(deposit);
      onMessage("Deposit finished");
      return;
    }

    if (token.type === WalletType.EVM && this.wibe3.isEvmWallet(sender)) {
      const hash = await this.wibe3.hotBridge.evm.deposit({
        sendTransaction: async (tx) => sender.sendTransaction(token.chain, tx),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      if (!hash) throw new Error("Failed to deposit");
      onMessage("Waiting for deposit");
      const deposit = await this.wibe3.hotBridge.waitPendingDeposit(token.chain, hash, recipient.omniAddress);
      onMessage("Finishing deposit");
      await this.wibe3.hotBridge.finishDeposit(deposit);
      onMessage("Deposit finished");
      return;
    }

    if (token.type === WalletType.NEAR && this.wibe3.isNearWallet(sender)) {
      return await this.wibe3.hotBridge.near.deposit({
        sendTransaction: async (tx: any) => sender.sendTransaction(tx),
        intentAccount: recipient.omniAddress,
        sender: sender.address,
        token: token.address,
        amount: amount,
      });
    }

    throw new Error("Unsupported token");
  }

  async withdraw(args: { sender: OmniWallet; token: Token; amount: bigint; recipient: Recipient }, pending: { log: (message: string) => void }) {
    const { sender, token, amount, recipient } = args;

    const receipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
    if (this.wibe3.isNearWallet(receipientWallet) && token.type === WalletType.NEAR) {
      pending.log("Registering NEAR token");
      await receipientWallet.registerToken(token.originalAddress);
    }

    pending.log("Withdrawing token");
    await this.wibe3.hotBridge.withdrawToken({
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
    if (request.sender === "qr") throw new Error("Sender is QR");
    if (request.to.chain === Network.Near || request.to.chain === Network.Hot) return 0n;
    const gaslessFee = await this.wibe3.hotBridge.getGaslessWithdrawFee({
      receiver: request.recipient.address,
      token: request.to.address,
      chain: request.to.chain,
    });

    if (gaslessFee.gasPrice === 0n) return 0n;
    if (request.to.address === "native") return 0n;

    // if withdraw token is not native, we need to swap a bit of it to native to cover the withdraw fee
    const swap = await this.wibe3.hotBridge.buildSwapExectOutIntent({
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
    const directChains = [Network.Near, Network.Juno, Network.Gonka, Network.ADI];
    const deadline = new Date(Date.now() + deadlineTime).toISOString();
    const noFee = from.symbol === to.symbol || (from.symbol.toLowerCase().includes("usd") && to.symbol.toLowerCase().includes("usd"));

    if (sender !== "qr" && directChains.includes(from.chain) && to.chain === Network.Hot && from.omniAddress === to.omniAddress) {
      const fee = await this.wibe3.hotBridge.getDepositFee({
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
      const isTokenActivated = await StellarWallet.isTokenActivated(recipient.address, request.to.address);
      const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
      if (!isTokenActivated && !recipientWallet) throw "Token not activated for recipient";
    }

    let qoute: QuoteResponse | null = null;
    try {
      qoute = await OneClickService.getQuote({
        originAsset: intentFrom,
        destinationAsset: intentTo,
        quoteWaitingTimeMs: 3000,
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

  async makeSwap(review: BridgeReview, pending: { log: (message: string) => void }): Promise<{ review: BridgeReview; processing?: () => Promise<BridgeReview> }> {
    const { sender, recipient } = review;

    if (review.qoute === "withdraw") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.withdraw({ sender, token: review.to, amount: review.amountIn, recipient }, pending);
      const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
      if (recipientWallet) this.wibe3.fetchToken(review.to, recipientWallet);
      this.wibe3.fetchToken(review.from, sender);
      return { review };
    }

    if (review.qoute === "deposit") {
      if (sender === "qr") throw new Error("Sender is QR");
      await this.deposit({ sender, token: review.from, amount: review.amountIn, recipient, onMessage: pending.log });
      this.wibe3.fetchToken(review.from, sender);

      const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
      if (recipientWallet) this.wibe3.fetchToken(review.to, recipientWallet);
      return { review };
    }

    if (sender !== "qr") {
      if (recipient.type === WalletType.STELLAR) {
        const isTokenActivated = await StellarWallet.isTokenActivated(recipient.address, review.to.address);
        const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
        if (!isTokenActivated && !recipientWallet) throw "Token not activated for recipient";
        if (!isTokenActivated && recipientWallet instanceof StellarWallet) {
          await recipientWallet.changeTrustline(review.to.address);
        }
      }

      const depositAddress = review.qoute.depositAddress!;
      let hash = "";

      if (review.from.chain === Network.Hot) {
        hash = await this.wibe3
          .intentsBuilder(sender)
          .transfer({ amount: review.amountIn, token: review.from.address as OmniToken, recipient: depositAddress })
          .execute();
      } else {
        hash = await sender.transfer({
          receiver: depositAddress,
          amount: review.amountIn,
          comment: review.qoute.depositMemo,
          gasFee: review.fee ?? undefined,
          token: review.from,
        });
      }

      this.wibe3.fetchToken(review.from, sender);
      OneClickService.submitDepositTx({ txHash: hash, depositAddress }).catch(() => {});
    }

    return {
      review,
      processing: async () => {
        const recipientWallet = this.wibe3.wallets.find((w) => w.address === recipient.address);
        if (!recipientWallet) return await this.processing(review);

        const beforeBalance = await this.wibe3.fetchToken(review.to, recipientWallet).catch(() => null);
        if (!beforeBalance) return await this.processing(review);

        return await Promise.race([
          this.waitBalance(review.to, recipientWallet, beforeBalance, review),
          this.processing(review), //
        ]);
      },
    };
  }

  async waitBalance(to: Token, wallet: OmniWallet, beforeBalance: bigint, review: BridgeReview): Promise<BridgeReview> {
    const afterBalance = await this.wibe3.fetchToken(to, wallet).catch(() => beforeBalance);
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
