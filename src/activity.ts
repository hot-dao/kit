import { WithdrawArgsWithPending } from "@hot-labs/omni-sdk";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { hex } from "@scure/base";

import { chains, Network, WalletType } from "./core";
import { OmniWallet } from "./core/OmniWallet";
import { HotConnector } from "./HotConnector";

export class Activity {
  withdrawals: Record<number, (WithdrawArgsWithPending & { loading?: boolean })[]> = {};

  constructor(private readonly kit: HotConnector) {
    makeObservable(this, { withdrawals: observable, withdrawalsList: computed });
    kit.onConnect(({ wallet }) => this.fetchPendingWithdrawalsByWallet(wallet));
  }

  get withdrawalsList() {
    return Object.values(this.withdrawals).flat();
  }

  async finishWithdrawal(withdrawal: WithdrawArgsWithPending & { loading?: boolean }) {
    try {
      if (withdrawal.loading) return;
      runInAction(() => (withdrawal.loading = true));

      if (withdrawal.chain === Network.Stellar) {
        if (!this.kit.stellar) throw new Error("Stellar wallet not connected");
        await this.kit.exchange.bridge.stellar.withdraw({
          sendTransaction: (tx: any) => this.kit.stellar!.sendTransaction(tx),
          sender: this.kit.stellar.address,
          ...withdrawal,
        });
      }

      if (withdrawal.chain === Network.Solana) {
        if (!this.kit.solana) throw new Error("Solana wallet not connected");
        const solana = await this.kit.exchange.bridge.solana();
        await solana.withdraw({
          sendTransaction: (tx: any) => this.kit.solana!.sendTransaction(tx),
          sender: this.kit.solana.address,
          ...withdrawal,
        });
      }

      if (withdrawal.chain === Network.Ton || withdrawal.chain === Network.OmniTon) {
        if (!this.kit.ton) throw new Error("Ton wallet not connected");
        await this.kit.exchange.bridge.ton.withdraw({
          sendTransaction: (tx: any) => this.kit.ton!.sendTransaction(tx),
          refundAddress: this.kit.ton.address,
          ...withdrawal,
        });
      }

      if (chains.get(withdrawal.chain).type === WalletType.EVM) {
        if (!this.kit.evm) throw new Error("EVM wallet not connected");
        await this.kit.exchange.bridge.evm.withdraw({
          sendTransaction: (tx: any) => this.kit.evm!.sendTransaction(tx),
          ...withdrawal,
        });
      }

      if (withdrawal.chain === Network.Gonka) {
        if (!this.kit.cosmos) throw new Error("Gonka wallet not connected");
        const cosmos = await this.kit.exchange.bridge.cosmos();
        await cosmos.withdraw({
          sendTransaction: (tx: any) => this.kit.cosmos!.sendTransaction(tx),
          senderPublicKey: hex.decode(this.kit.cosmos.publicKey!),
          sender: this.kit.cosmos.address,
          ...withdrawal,
        });
      }

      await this.kit.exchange.bridge.clearPendingWithdrawals([withdrawal]).catch(() => {});
    } finally {
      runInAction(() => (withdrawal.loading = false));
      const wallet = this.kit.wallets.find((w) => w.type === chains.get(withdrawal.chain).type);
      if (wallet) this.fetchPendingWithdrawalsByChain(withdrawal.chain, wallet);
    }
  }

  async fetchPendingWithdrawalsByWallet(wallet: OmniWallet) {
    if (wallet.type === WalletType.NEAR) return;
    if (wallet.type === WalletType.HotCraft) return;
    const tasks = chains.getByType(wallet.type).map((t) => this.fetchPendingWithdrawalsByChain(t.id, wallet));
    await Promise.all(tasks);
  }

  async fetchPendingWithdrawalsByChain(chain: number, wallet: OmniWallet) {
    const pendings = await this.kit.exchange.bridge.getPendingWithdrawalsWithStatus(chain, wallet.address);
    runInAction(() => (this.withdrawals[chain] = pendings.filter((t) => !t.completed)));
  }
}
