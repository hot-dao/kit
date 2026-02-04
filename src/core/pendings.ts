import { makeObservable, observable, runInAction } from "mobx";
import { GetExecutionStatusResponse, OneClickService } from "@defuse-protocol/one-click-sdk-typescript";
import { v4 as uuidv4 } from "uuid";

import type { ToastController } from "../ui/toast";
import type { HotKit } from "../HotKit";

import { wait } from "../hot-wallet/iframe";
import { OmniWallet } from "../core/OmniWallet";
import { BridgeReview } from "../core/exchange";
import { Token } from "./token";

export abstract class ActivityController {
  status: "pending" | "success" | "failed" = "pending";
  id = uuidv4();

  title: string | null = null;
  subtitle: string | null = null;

  preview: Token | string | null = null;
  actionLoading: boolean = false;
  actionText: string | null = null;

  action(): Promise<void> {
    throw new Error("Not implemented");
  }

  constructor() {
    makeObservable(this, {
      status: observable,
      subtitle: observable,
      actionText: observable,
      actionLoading: observable,
      preview: observable,
      title: observable,
    });
  }
}

export class BridgePending extends ActivityController {
  readonly processingTask: Promise<BridgeReview>;
  private toast?: ToastController;

  constructor(readonly review: BridgeReview, readonly kit?: HotKit) {
    super();

    this.processingTask = this._processing();
    this.title = this.getTitle();

    this.toast = this.kit?.toast.pending(this.title);
    this.preview = this.review.to;
  }

  serialize() {
    return {};
  }

  getTitle() {
    const from = `${this.review.from.readable(this.review.amountIn)} ${this.review.from.symbol}`;
    const to = `${this.review.to.readable(this.review.amountOut)} ${this.review.to.symbol}`;

    if (this.review.from.originalId === this.review.to.originalId) {
      if (this.review.from.isOmni) return `Withdraw ${from}`;
      if (this.review.to.isOmni) return `Deposit ${to}`;
    }

    const fromChain = this.review.from.chainName.toLowerCase();
    const toChain = this.review.to.chainName.toLowerCase();
    return `${from} (${fromChain}) → ${to} (${toChain})`;
  }

  updateStatus(status: "pending" | "success" | "failed", statusMessage: string | null) {
    runInAction(() => {
      this.status = status;
      this.subtitle = statusMessage;
      this.toast?.update({ type: status, progressText: statusMessage || "Processing..." });
      this.review.statusMessage = "Swap successful";
      this.review.status = "success";
    });
  }

  processing() {
    return this.processingTask;
  }

  async _processing() {
    if (this.review.qoute === "deposit" || this.review.qoute === "withdraw") return this.review;

    if (!(this.review.recipient instanceof OmniWallet)) return await this.waitStatus();
    const beforeBalance = await this.review.recipient.fetchBalance(this.review.to.chain, this.review.to.address).catch(() => null);
    if (!beforeBalance) return await this.waitStatus();

    return await Promise.race([
      this.waitBalance(this.review.to, this.review.recipient, beforeBalance, this.review), //
      this.waitStatus(),
    ]);
  }

  async waitBalance(to: Token, wallet: OmniWallet, beforeBalance: bigint, review: BridgeReview): Promise<BridgeReview> {
    const afterBalance = await wallet.fetchBalance(to.chain, to.address).catch(() => beforeBalance);
    if (afterBalance > beforeBalance) {
      return runInAction(() => {
        this.review.amountOut = afterBalance - beforeBalance;
        this.updateStatus("success", "Swap successful");
        this.toast?.update({ duration: 2000 });
        return this.review;
      });
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

  async checkStatus() {
    if (this.review.qoute === "deposit" || this.review.qoute === "withdraw") return;
    const status = await OneClickService.getExecutionStatus(this.review.qoute.depositAddress!, this.review.qoute.depositMemo);
    const message = this.getMessage(status.status);

    let state: "pending" | "success" | "failed" = "pending";
    if (status.status === GetExecutionStatusResponse.status.SUCCESS) state = "success";
    if (status.status === GetExecutionStatusResponse.status.FAILED) state = "failed";
    if (status.status === GetExecutionStatusResponse.status.REFUNDED) state = "failed";

    runInAction(() => {
      if (status.swapDetails.amountOut) this.review.amountOut = BigInt(status.swapDetails.amountOut);
      this.updateStatus(state, message);
    });
  }

  async waitStatus(interval = 3000) {
    while (this.status === "pending") {
      await this.checkStatus();
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    if (this.status === "success") return this.review;
    if (this.status === "failed") throw this.subtitle || "Bridge failed";
    throw new Error("Unknown status");
  }
}
