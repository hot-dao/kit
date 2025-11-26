import { makeObservable, observable, runInAction } from "mobx";

import { EventEmitter } from "../events";
import { LocalStorage } from "../storage";

import { OmniWallet, WalletType } from "./OmniWallet";
import { openLogoutPopup } from "../ui/router";

export enum ConnectorType {
  WALLET = "wallet",
  SOCIAL = "social",
}

export interface OmniConnectorOption {
  name: string;
  icon: string;
  id: string;
}

export abstract class OmniConnector<T extends OmniWallet = OmniWallet, O extends OmniConnectorOption = OmniConnectorOption> {
  wallets: T[] = [];
  options: O[] = [];

  private storage = new LocalStorage();
  protected events = new EventEmitter<{
    connect: { wallet: T };
    disconnect: { wallet: T };
  }>();

  constructor() {
    makeObservable(this, {
      wallets: observable,
      options: observable,
    });
  }

  abstract silentDisconnect(): Promise<void>;
  abstract connect(id?: string): Promise<void>;

  abstract walletTypes: WalletType[];
  abstract type: ConnectorType;
  abstract name: string;
  abstract icon: string;
  abstract id: string;

  protected setWallet(wallet: T) {
    runInAction(() => this.wallets.push(wallet));
    this.events.emit("connect", { wallet });
  }

  protected removeWallet() {
    runInAction(() => {
      const wallet = this.wallets.pop();
      if (wallet) this.events.emit("disconnect", { wallet });
    });
  }

  protected removeAllWallets(): void {
    runInAction(() => {
      const wallets = this.wallets;
      this.wallets = [];
      wallets.forEach((wallet) => this.events.emit("disconnect", { wallet }));
    });
  }

  async setStorage(obj: { type?: string; id?: string; address?: string; publicKey?: string }) {
    await this.storage.set(`wibe3:${this.id}`, JSON.stringify(obj));
  }

  async removeStorage() {
    await this.storage.remove(`wibe3:${this.id}`);
  }

  async getStorage(): Promise<{ type?: string; id?: string; address?: string; publicKey?: string }> {
    const data = await this.storage.get(`wibe3:${this.id}`);
    if (!data) throw new Error("No storage found");
    return JSON.parse(data);
  }

  removeAllListeners() {
    this.events.removeAllListeners();
  }

  onConnect(handler: (payload: { wallet: T }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: T }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async disconnect({ silent = false }: { silent?: boolean } = {}) {
    if (silent) return this.silentDisconnect();
    try {
      await openLogoutPopup(this);
      await this.silentDisconnect();
      this.removeWallet();
    } catch (error) {
      // User rejected - error is already handled by openLogoutPopup
      throw error;
    }
  }
}
