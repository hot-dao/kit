import { action, computed, makeObservable, observable, runInAction } from "mobx";

import { chains, WalletType } from "./core/chains";
import { BridgePending } from "./core/pendings";
import { OmniWallet } from "./core/OmniWallet";

import type { HotKit } from "./HotKit";
import { HotBridgeWithdrawal } from "./HotBridgeWithdrawal";

export class Activity {
  withdrawals: Record<number, HotBridgeWithdrawal[]> = {};
  bridgePending: BridgePending[] = [];

  constructor(private readonly kit: HotKit) {
    makeObservable(this, {
      withdrawals: observable,
      bridgePending: observable,
      activityList: computed,
      addBridgePending: action,
    });

    kit.onConnect(({ wallet }) => this.fetchPendingWithdrawalsByWallet(wallet));
  }

  get activityList() {
    return [...this.bridgePending, ...Object.values(this.withdrawals).flat()];
  }

  addBridgePending(bridgePending: BridgePending) {
    this.bridgePending.push(bridgePending);
    // this.kit.storage.set(`activity:bridgePendings`, JSON.stringify(this.bridgePending.map((t) => t.serialize())));
  }

  async fetchPendingWithdrawalsByWallet(wallet: OmniWallet) {
    if (wallet.type === WalletType.NEAR) return;
    if (wallet.type === WalletType.HotCraft) return;
    const tasks = chains.getByType(wallet.type).map((t) => this.fetchPendingWithdrawalsByChain(t.id, wallet));
    await Promise.all(tasks);
  }

  async fetchPendingWithdrawalsByChain(chain: number, wallet: OmniWallet) {
    const pendings = await this.kit.exchange.bridge.getPendingWithdrawalsWithStatus(chain, wallet.address);
    runInAction(() => (this.withdrawals[chain] = pendings.filter((t) => !t.completed).map((t) => new HotBridgeWithdrawal(t, this.kit))));
  }
}
