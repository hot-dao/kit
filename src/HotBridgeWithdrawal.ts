import { WithdrawArgsWithPending } from "@hot-labs/omni-sdk";
import { runInAction } from "mobx";
import { hex } from "@scure/base";

import type { HotKit } from "./HotKit";

import { chains, Network, OmniToken, WalletType } from "./core/chains";
import { ActivityController } from "./core/pendings";
import { tokens } from "./core/tokens";

export class HotBridgeWithdrawal extends ActivityController {
  actionText = "Withdraw";

  constructor(readonly args: WithdrawArgsWithPending, readonly kit: HotKit) {
    super();
    this.preview = tokens.get(this.args.token as OmniToken, this.args.chain);
    this.title = `${this.preview.float(this.args.amount)} ${this.preview.symbol}`;
    this.subtitle = new Date(this.args.timestamp).toLocaleString();
  }

  async action() {
    try {
      if (this.status === "pending") return;
      runInAction(() => (this.status = "pending"));

      if (this.args.chain === Network.Stellar) {
        if (!this.kit.stellar) throw new Error("Stellar wallet not connected");
        await this.kit.exchange.bridge.stellar.withdraw({
          sendTransaction: (tx: any) => this.kit.stellar!.sendTransaction(tx),
          sender: this.kit.stellar.address,
          ...this.args,
        });
      }

      if (this.args.chain === Network.Solana) {
        if (!this.kit.solana) throw new Error("Solana wallet not connected");
        const solana = await this.kit.exchange.bridge.solana();
        await solana.withdraw({
          sendTransaction: (tx: any) => this.kit.solana!.sendTransaction(tx),
          sender: this.kit.solana.address,
          ...this.args,
        });
      }

      if (this.args.chain === Network.Ton || this.args.chain === Network.OmniTon) {
        if (!this.kit.ton) throw new Error("Ton wallet not connected");
        await this.kit.exchange.bridge.ton.withdraw({
          sendTransaction: (tx: any) => this.kit.ton!.sendTransaction(tx),
          refundAddress: this.kit.ton.address,
          ...this.args,
        });
      }

      if (chains.get(this.args.chain).type === WalletType.EVM) {
        if (!this.kit.evm) throw new Error("EVM wallet not connected");
        await this.kit.exchange.bridge.evm.withdraw({
          sendTransaction: (tx: any) => this.kit.evm!.sendTransaction(tx),
          ...this.args,
        });
      }

      if (this.args.chain === Network.Gonka) {
        if (!this.kit.cosmos) throw new Error("Gonka wallet not connected");
        const cosmos = await this.kit.exchange.bridge.cosmos();
        await cosmos.withdraw({
          sendTransaction: (tx: any) => this.kit.cosmos!.sendTransaction(tx),
          senderPublicKey: hex.decode(this.kit.cosmos.publicKey!),
          sender: this.kit.cosmos.address,
          ...this.args,
        });
      }

      await this.kit.exchange.bridge.clearPendingWithdrawals([this.args]).catch(() => {});
    } finally {
      runInAction(() => (this.status = "success"));
      const wallet = this.kit.wallets.find((w) => w.type === chains.get(this.args.chain).type);
      if (wallet) this.kit.activity.fetchPendingWithdrawalsByChain(this.args.chain, wallet);
    }
  }
}
