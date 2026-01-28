import { makeObservable, observable, runInAction } from "mobx";
import UniversalProvider, { NamespaceConfig } from "@walletconnect/universal-provider";

import type { HotConnector } from "../HotConnector";
import { EventEmitter } from "./events";
import { OmniWallet } from "./OmniWallet";
import { WalletType } from "./chains";

export enum ConnectorType {
  WALLET = "wallet",
  SOCIAL = "social",
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
    connect: { wallet: T; connector: OmniConnector<T, O> };
    disconnect: { wallet: T; connector: OmniConnector<T, O> };
  }>();

  protected wc: Promise<UniversalProvider> | null = null;

  constructor(readonly wibe3: HotConnector) {
    makeObservable(this, {
      wallets: observable,
      options: observable,
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

  protected setWallet(wallet: T) {
    const existing = this.wallets.find((t) => t.address === wallet.address);
    if (existing) return existing;

    runInAction(() => this.wallets.push(wallet));
    this.events.emit("connect", { wallet, connector: this });
    return wallet;
  }

  protected removeWallet() {
    runInAction(() => {
      const wallet = this.wallets.pop();
      if (wallet) this.events.emit("disconnect", { wallet, connector: this });
    });
  }

  protected removeAllWallets(): void {
    runInAction(() => {
      const wallets = this.wallets;
      this.wallets = [];
      wallets.forEach((wallet) => this.events.emit("disconnect", { wallet, connector: this }));
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

  onConnect(handler: (payload: { wallet: T; connector: OmniConnector<T, O> }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
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
