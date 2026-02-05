import { action, makeObservable, observable, runInAction } from "mobx";
import { GetExecutionStatusResponse, OneClickService } from "@defuse-protocol/one-click-sdk-typescript";
import { v4 as uuidv4 } from "uuid";

import type { ToastController } from "../ui/toast";
import type { HotKit } from "../HotKit";

import { wait } from "../hot-wallet/iframe";
import { OmniWallet } from "../core/OmniWallet";
import { BridgeReview } from "../core/exchange";
import { tokens } from "./tokens";
import { Token } from "./token";

export abstract class ActivityController {
  id = uuidv4();

  title = "";
  subtitle = "";
  status: "pending" | "success" | "failed" = "pending";
  preview: Token | string = "";

  actionLoading = false;
  actionText = "";

  toast?: ToastController;
  action(): Promise<void> {
    throw new Error("Not implemented");
  }

  update({ title, subtitle, status }: { title?: string; subtitle?: string; status?: "pending" | "success" | "failed" }) {
    this.title = title || this.title;
    this.subtitle = subtitle || this.subtitle;
    this.status = status || this.status;

    if (this.status === "pending") {
      this.toast?.update({ progressText: this.subtitle || undefined });
      return;
    }

    this.toast?.update({
      message: this.title,
      progressText: this.subtitle,
      type: this.status,
      duration: 3000,
    });
  }

  constructor() {
    makeObservable(this, {
      status: observable,
      subtitle: observable,
      actionText: observable,
      actionLoading: observable,
      preview: observable,
      title: observable,
      update: action,
    });
  }
}

export class BridgePending extends ActivityController {
  readonly processingTask: Promise<BridgeReview>;

  constructor(readonly review: BridgeReview & { status?: "pending" | "success" | "failed"; statusMessage?: string | null }, readonly kit?: HotKit) {
    super();

    this.processingTask = this._processing();
    this.title = this.getTitle();

    this.subtitle = this.review.statusMessage || "Swap processing";
    this.status = this.review.status || "pending";
    this.preview = this.review.to;

    if (this.status === "pending") {
      this.toast = this.kit?.toast.pending(this.title);
    }
  }

  static deserialize(data: any, kit?: HotKit) {
    return new BridgePending(
      {
        amountIn: BigInt(data.amountIn),
        amountOut: BigInt(data.amountOut),
        minAmountOut: BigInt(data.minAmountOut),
        from: tokens.list.find((t) => t.id === data.from)!,
        to: tokens.list.find((t) => t.id === data.to)!,
        statusMessage: data.statusMessage,
        slippage: data.slippage,
        status: data.status,
        qoute: data.qoute,
        fee: null,
      },
      kit
    );
  }

  serialize() {
    return {
      status: this.status,
      statusMessage: this.subtitle,
      amountIn: String(this.review.amountIn),
      amountOut: String(this.review.amountOut),
      minAmountOut: String(this.review.minAmountOut),
      slippage: this.review.slippage,
      qoute: this.review.qoute,
      from: this.review.from.id,
      to: this.review.to.id,
    };
  }

  getTitle() {
    const from = `${this.review.from.readable(this.review.amountIn)} ${this.review.from.symbol}`;
    const to = `${this.review.to.readable(this.review.amountOut)} ${this.review.to.symbol}`;

    if (this.review.from.originalId === this.review.to.originalId) {
      if (this.review.from.isOmni) return `Withdraw ${from}`;
      if (this.review.to.isOmni) return `Deposit ${to}`;
    }

    return `${from} → ${to}`;
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
      this.waitBalance(this.review.to, this.review.recipient, beforeBalance), //
      this.waitStatus(),
    ]);
  }

  async waitBalance(to: Token, wallet: OmniWallet, beforeBalance: bigint): Promise<BridgeReview> {
    const afterBalance = await wallet.fetchBalance(to.chain, to.address).catch(() => beforeBalance);
    if (afterBalance > beforeBalance) {
      this.review.amountOut = afterBalance - beforeBalance;
      this.update({ status: "success", subtitle: "Swap successful" });
      this.kit?.activity.sync();
      return this.review;
    }

    await wait(2000);
    return await this.waitBalance(to, wallet, beforeBalance);
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

    if (Date.now() - +new Date(status.updatedAt) > 30_000 * 60) {
      this.update({ status: "failed", subtitle: "Transaction timed out" });
      this.kit?.activity.sync();
      return;
    }

    const message = this.getMessage(status.status);
    let state: "pending" | "success" | "failed" = "pending";
    if (status.status === GetExecutionStatusResponse.status.SUCCESS) state = "success";
    if (status.status === GetExecutionStatusResponse.status.FAILED) state = "failed";
    if (status.status === GetExecutionStatusResponse.status.REFUNDED) state = "failed";

    if (status.swapDetails.amountOut) this.review.amountOut = BigInt(status.swapDetails.amountOut);
    this.update({ subtitle: message || undefined });
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
