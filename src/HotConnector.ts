import { computed, makeObservable, observable, runInAction } from "mobx";

import { openBridge, openConnector, openPayment, openProfile } from "./ui/router";
import { OmniWallet } from "./omni/OmniWallet";
import { WalletType } from "./omni/config";

import { ConnectorType, OmniConnector } from "./omni/OmniConnector";
import NearConnector, { NearConnectorOptions } from "./near/connector";
import EvmConnector, { EvmConnectorOptions } from "./evm/connector";
import SolanaConnector, { SolanaConnectorOptions } from "./solana/connector";
import CosmosConnector, { CosmosConnectorOptions } from "./cosmos/connector";
import TonConnector, { TonConnectorOptions } from "./ton/connector";
import StellarConnector from "./stellar/connector";
import GoogleConnector from "./google";

import { omni } from "./omni/exchange";
import { OmniToken } from "./omni/config";
import { Token } from "./omni/token";
import { GlobalSettings } from "./settings";
import { EventEmitter } from "./events";

import NearWallet from "./near/wallet";
import EvmWallet from "./evm/wallet";
import SolanaWallet from "./solana/wallet";
import StellarWallet from "./stellar/wallet";
import TonWallet from "./ton/wallet";
import CosmosWallet from "./cosmos/wallet";
import IntentsBuilder from "./omni/builder";

export const near = (options?: NearConnectorOptions) => new NearConnector(options);
export const evm = (options?: EvmConnectorOptions) => new EvmConnector(options);
export const solana = (options?: SolanaConnectorOptions) => new SolanaConnector(options);
export const stellar = () => new StellarConnector();
export const cosmos = (options?: CosmosConnectorOptions) => new CosmosConnector(options);
export const ton = (options?: TonConnectorOptions) => new TonConnector(options);
export const google = () => new GoogleConnector();

interface HotConnectorOptions extends EvmConnectorOptions, SolanaConnectorOptions, TonConnectorOptions, NearConnectorOptions {
  webWallet?: string;
  connectors?: OmniConnector[];
  tonApi?: string;
}

export class HotConnector {
  public connectors: OmniConnector[] = [];
  public balances: Record<string, Record<string, bigint>> = {};

  private events = new EventEmitter<{
    connect: { wallet: OmniWallet };
    disconnect: { wallet: OmniWallet };
    tokensUpdate: { tokens: Token[] };
  }>();

  constructor(options?: HotConnectorOptions) {
    makeObservable(this, {
      balances: observable,
      tokens: computed,
      wallets: computed,
      near: computed,
      evm: computed,
      solana: computed,
      stellar: computed,
      ton: computed,
      cosmos: computed,
    });

    this.connectors = [google(), near(), evm(options), solana(options), stellar(), ton(options), cosmos()];
    GlobalSettings.webWallet = options?.webWallet ?? GlobalSettings.webWallet;
    GlobalSettings.tonApi = options?.tonApi ?? GlobalSettings.tonApi;

    this.connectors.forEach((t) => {
      t.onConnect((payload) => this.events.emit("connect", payload));
      t.onDisconnect((payload) => this.events.emit("disconnect", payload));
    });

    this.onConnect((payload) => this.fetchTokens(payload.wallet));
    this.onDisconnect(({ wallet }) => {
      if (!wallet) return;
      runInAction(() => (this.balances[`${wallet.type}:${wallet.address}`] = {}));
    });
  }

  getWalletConnector(type: WalletType): OmniConnector | null {
    return this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type)) ?? null;
  }

  get wallets(): OmniWallet[] {
    return this.connectors.flatMap((t) => t.wallets);
  }

  get near(): NearWallet | null {
    return this.wallets.find((w) => w.type === WalletType.NEAR) as NearWallet | null;
  }

  get evm(): EvmWallet | null {
    return this.wallets.find((w) => w.type === WalletType.EVM) as EvmWallet | null;
  }

  get solana(): SolanaWallet | null {
    return this.wallets.find((w) => w.type === WalletType.SOLANA) as SolanaWallet | null;
  }

  get stellar(): StellarWallet | null {
    return this.wallets.find((w) => w.type === WalletType.STELLAR) as StellarWallet | null;
  }

  get ton(): TonWallet | null {
    return this.wallets.find((w) => w.type === WalletType.TON) as TonWallet | null;
  }

  get cosmos(): CosmosWallet | null {
    return this.wallets.find((w) => w.type === WalletType.COSMOS) as CosmosWallet | null;
  }

  get tokens(): Token[] {
    return omni.tokens;
  }

  balance(wallet?: OmniWallet, token?: Token) {
    if (!wallet || !token) return 0n;
    return this.balances[`${wallet.type}:${wallet.address}`][token.id] ?? 0n;
  }

  async fetchTokens(wallet: OmniWallet) {
    const key = `${wallet.type}:${wallet.address}`;
    if (!this.balances[key]) this.balances[key] = {};

    this.tokens.forEach(async (token) => {
      if (token.type !== wallet.type) return;
      if (token.type === WalletType.OMNI) return;
      const balance = await wallet.fetchBalance(token.chain, token.address);
      runInAction(() => (this.balances[key][token.id] = balance));
    });

    wallet.getAssets().then((assets) => {
      runInAction(() => {
        console.log({ assets });
        Object.keys(assets).forEach((id) => {
          this.balances[key][`-4:${id}`] = assets[id];
        });
      });
    });
  }

  async payment(token: OmniToken, amount: number, receiver: string) {
    if (!token) throw new Error("Token not found");
    const ftToken = this.tokens.find((t) => t.omniAddress === token)!;
    await openPayment(this, ftToken, ftToken.int(amount), receiver);
  }

  onConnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async withdraw(token: OmniToken, amount: number) {
    const omniToken = this.tokens.find((t) => t.address === token)!;
    const originalToken = this.tokens.find((t) => t.chain === omniToken.originalChain && t.address === omniToken.originalAddress)!;

    const sender = this.wallets.sort((a, b) => {
      const aBalance = omniToken.float(this.balance(a, omniToken));
      const bBalance = omniToken.float(this.balance(b, omniToken));
      return bBalance - aBalance;
    })[0];

    await openBridge(this, {
      sender: sender,
      receipient: this.wallets.find((w) => w.type === originalToken.type) as OmniWallet,
      to: originalToken,
      from: omniToken,
      amount: amount,
    });
  }

  async deposit(token: OmniToken, amount: number) {
    const omni = this.tokens.find((t) => t.address === token)!;
    const orig = this.tokens.find((t) => t.chain === omni.originalChain && t.address === omni.originalAddress)!;
    const sender = this.wallets.find((t) => t.type === orig.type)!;

    return openBridge(this, {
      sender: sender,
      receipient: this.wallets.find((w) => !!w.omniAddress) as OmniWallet,
      amount: amount,
      from: orig,
      to: omni,
    });
  }

  async openBridge() {
    await openBridge(this);
  }

  async connect(type?: string) {
    if (this.wallets.length > 0) return openProfile(this);
    const connector = this.connectors.find((t) => t.id === type);
    await openConnector(this, connector);
  }
}
