import { action, makeObservable, observable, runInAction } from "mobx";
import UniversalProvider, { NamespaceConfig } from "@walletconnect/universal-provider";

import type { HotConnector } from "../HotConnector";
import { EventEmitter } from "./events";
import { OmniWallet } from "./OmniWallet";
import { WalletType } from "./chains";

export enum ConnectorType {
  WALLET = "wallet",
  SOCIAL = "social",
  HOTCRAFT = "hotcraft",
}

export interface OmniConnectorOption {
  name: string;
  icon: string;
  id: string;
  download?: string;
  deeplink?: string;
  type: "extension" | "external";
}

export const WC_ICON = "https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/refs/heads/master/Icon/Blue%20(Default)/Icon.svg";

export abstract class OmniConnector<T extends OmniWallet = OmniWallet, O = {}> {
  wallets: T[] = [];
  options: (O & OmniConnectorOption)[] = [];
  description?: string;

  protected events = new EventEmitter<{
    restore_connect: { wallet: T; connector: OmniConnector<T, O> };
    new_connect: { wallet: T; connector: OmniConnector<T, O> };
    disconnect: { wallet: T; connector: OmniConnector<T, O> };
  }>();

  protected wc: Promise<UniversalProvider> | null = null;

  constructor(readonly wibe3: HotConnector) {
    makeObservable(this, {
      wallets: observable,
      options: observable,
      removeWallet: action,
      removeAllWallets: action,
    });
  }

  get storage() {
    return this.wibe3.storage;
  }

  openWallet() {}

  async initWalletConnect() {
    if (!this.wibe3.settings?.projectId) throw new Error("Project ID is required");
    if (this.wc) return this.wc;
    this.wc = UniversalProvider.init({
      relayUrl: "wss://relay.walletconnect.org",
      projectId: this.wibe3.settings?.projectId,
      metadata: this.wibe3.settings?.metadata,
      customStoragePrefix: `wibe3:${this.id}`,
      name: this.name,
    });

    return this.wc;
  }

  async connectWalletConnect(args: { deeplink?: string; onConnect: () => Promise<OmniWallet>; namespaces: NamespaceConfig }): Promise<{ qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    const provider = await this.wc;
    if (!provider) throw new Error("No provider found");

    return new Promise((resolve) => {
      const session = provider.connect({ namespaces: args.namespaces });
      const handler = (uri: string) => {
        provider.off("display_uri", handler);
        resolve({ qrcode: uri, deeplink: `${args.deeplink || "wc://"}${encodeURIComponent(uri)}`, task: session.then(args.onConnect) });
      };
      provider.on("display_uri", handler);
    });
  }

  async disconnectWalletConnect() {
    const provider = await this.wc;
    if (provider?.session) await provider.disconnect();
    provider?.cleanupPendingPairings();
  }

  async requestWalletConnect<T>(args: { chain?: string; request: any; deeplink?: string; name?: string; icon?: string }): Promise<T> {
    const { openWCRequest } = await import("../ui/router");
    return openWCRequest<T>({
      deeplink: args.deeplink,
      name: args.name || "WalletConnect",
      icon: args.icon || WC_ICON,
      request: args.request,
      task: async () => {
        const wc = await this.wc;
        if (!wc) throw new Error("No provider found");
        return await wc.request<T>(args.request, args.chain);
      },
    });
  }

  abstract connect(id?: string): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }>;

  abstract walletTypes: WalletType[];
  abstract type: ConnectorType;
  abstract name: string;
  abstract icon: string;
  abstract id: string;

  protected setWallet({ wallet, isNew }: { wallet: T; isNew: boolean }) {
    const existing = this.wallets.find((t) => t.address === wallet.address);
    if (existing) return existing;

    runInAction(() => this.wallets.push(wallet));
    if (isNew) this.events.emit("new_connect", { wallet, connector: this });
    else this.events.emit("restore_connect", { wallet, connector: this });
    return wallet;
  }

  removeWallet(wallet?: T) {
    if (wallet) {
      this.wallets = this.wallets.filter((t) => t !== wallet);
      this.events.emit("disconnect", { wallet, connector: this });
      return;
    }

    if (this.wallets.length === 0) return;
    const deleted = this.wallets.pop()!;
    this.events.emit("disconnect", { wallet: deleted, connector: this });
  }

  removeAllWallets(): void {
    const wallets = this.wallets;
    this.wallets = [];

    wallets.forEach((wallet) => {
      this.events.emit("disconnect", { wallet, connector: this });
    });
  }

  async setStorage(obj: { type?: string; id?: string; address?: string; publicKey?: string; [key: string]: any }) {
    await this.storage.set(`wibe3:${this.id}`, JSON.stringify(obj));
  }

  async removeStorage() {
    await this.storage.remove(`wibe3:${this.id}`);
  }

  async getStorage(): Promise<{ type?: string; id?: string; address?: string; publicKey?: string; [key: string]: any }> {
    const data = await this.storage.get(`wibe3:${this.id}`);
    if (!data) return {};
    return JSON.parse(data);
  }

  removeAllListeners() {
    this.events.removeAllListeners();
  }

  onRestoreConnect(handler: (payload: { wallet: T; connector: OmniConnector<T, O> }) => void) {
    this.events.on("restore_connect", handler);
    return () => this.events.off("restore_connect", handler);
  }

  onNewConnect(handler: (payload: { wallet: T; connector: OmniConnector<T, O> }) => void) {
    this.events.on("new_connect", handler);
    return () => this.events.off("new_connect", handler);
  }

  onConnect(handler: (payload: { wallet: T; connector: OmniConnector<T, O> }) => void) {
    this.events.on("new_connect", handler);
    this.events.on("restore_connect", handler);
    return () => {
      this.events.off("new_connect", handler);
      this.events.off("restore_connect", handler);
    };
  }

  onDisconnect(handler: (payload: { wallet: T; connector: OmniConnector<T, O> }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async disconnect() {
    this.disconnectWalletConnect();
    this.removeAllWallets();
    this.removeStorage();
  }
}
