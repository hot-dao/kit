import { computed, makeObservable, observable, runInAction } from "mobx";

import { openBridge, openConnector, openPayment, openProfile, openWalletPicker } from "./ui/router";
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

import { Exchange } from "./omni/exchange";
import { OmniToken } from "./omni/config";
import { formatter, Token } from "./omni/token";
import { GlobalSettings } from "./settings";
import { EventEmitter } from "./events";

import NearWallet from "./near/wallet";
import EvmWallet from "./evm/wallet";
import SolanaWallet from "./solana/wallet";
import StellarWallet from "./stellar/wallet";
import TonWallet from "./ton/wallet";
import CosmosWallet from "./cosmos/wallet";
import { Intents } from "./omni/Intents";
import { Recipient } from "./omni/recipient";

export const near = (options?: NearConnectorOptions) => (wibe3: HotConnector) => new NearConnector(wibe3, options);
export const evm = (options?: EvmConnectorOptions) => (wibe3: HotConnector) => new EvmConnector(wibe3, options);
export const solana = (options?: SolanaConnectorOptions) => (wibe3: HotConnector) => new SolanaConnector(wibe3, options);
export const cosmos = (options?: CosmosConnectorOptions) => (wibe3: HotConnector) => new CosmosConnector(wibe3, options);
export const ton = (options?: TonConnectorOptions) => (wibe3: HotConnector) => new TonConnector(wibe3, options);
export const stellar = () => (wibe3: HotConnector) => new StellarConnector(wibe3);
export const google = () => (wibe3: HotConnector) => new GoogleConnector(wibe3);

interface HotConnectorOptions extends EvmConnectorOptions, SolanaConnectorOptions, TonConnectorOptions, NearConnectorOptions {
  webWallet?: string;
  connectors?: OmniConnector[];
  tonApi?: string;
}

export class HotConnector {
  public connectors: OmniConnector[] = [];
  public balances: Record<string, Record<string, bigint>> = {};
  public exchange = new Exchange(this);

  private events = new EventEmitter<{
    connect: { wallet: OmniWallet };
    disconnect: { wallet: OmniWallet };
    tokensUpdate: { tokens: Token[] };
  }>();

  constructor(options?: HotConnectorOptions) {
    makeObservable(this, {
      balances: observable,
      walletsTokens: computed,
      tokens: computed,
      wallets: computed,
      near: computed,
      evm: computed,
      solana: computed,
      stellar: computed,
      ton: computed,
      cosmos: computed,
    });

    this.connectors = [near(), evm(options), solana(options), stellar(), ton(options), cosmos()].map((t) => t(this));
    GlobalSettings.webWallet = options?.webWallet ?? GlobalSettings.webWallet;
    GlobalSettings.tonApi = options?.tonApi ?? GlobalSettings.tonApi;

    this.connectors.forEach((t) => {
      t.onConnect((payload) => this.events.emit("connect", payload));
      t.onDisconnect((payload) => this.events.emit("disconnect", payload));
    });

    this.onConnect((payload) => {
      this.fetchTokens(payload.wallet);
      this.fetchOmniTokens(payload.wallet);
    });

    this.onDisconnect(({ wallet }) => {
      if (!wallet) return;
      runInAction(() => (this.balances[`${wallet.type}:${wallet.address}`] = {}));
    });
  }

  getWalletConnector(type: WalletType): OmniConnector | null {
    return this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type)) ?? null;
  }

  omni(token: OmniToken) {
    return this.exchange.omni(token);
  }

  get priorityWallet() {
    if (this.near) return this.near;
    if (this.evm) return this.evm;
    if (this.solana) return this.solana;
    if (this.ton) return this.ton;
    if (this.stellar) return this.stellar;
    if (this.cosmos) return this.cosmos;
  }

  get wallets(): OmniWallet[] {
    return this.connectors.flatMap((t) => t.wallets);
  }

  get walletsTokens() {
    return this.wallets
      .flatMap((wallet) => {
        return this.tokens.map((token) => ({ token, wallet, balance: this.balance(wallet, token) }));
      })
      .filter((t) => t.balance !== 0n)
      .sort((a, b) => {
        const balanceA = a.token.float(a.balance) * a.token.usd;
        const balanceB = b.token.float(b.balance) * b.token.usd;
        return balanceB - balanceA;
      });
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
    return this.exchange.tokens;
  }

  getChainBalances(chain: number) {
    return this.tokens
      .filter((t) => t.chain === chain)
      .reduce((acc: number, token: Token) => {
        return this.wallets.reduce((acc: number, wallet) => {
          if (token.chain === chain) return acc;
          const balance = this.balances[`${wallet.type}:${wallet.address}`][token.id] ?? 0n;
          return acc + token.float(balance) * token.usd;
        }, acc);
      }, 0);
  }

  balance(wallet?: OmniWallet, token?: Token) {
    if (!wallet || !token) return 0n;
    return this.balances[`${wallet.type}:${wallet.address}`][token.id] ?? 0n;
  }

  omniBalance(token: OmniToken) {
    const omni = this.tokens.find((t) => t.address === token)!;
    const omniToken = this.walletsTokens.find((t) => t.token.address === omni.address);
    const onchainToken = this.walletsTokens.find((t) => t.token.address === omni.originalAddress);
    return {
      token: omni,
      omni: omniToken?.balance ?? 0n,
      onchain: onchainToken?.balance ?? 0n,
      total: +omni.float((omniToken?.balance ?? 0n) + (onchainToken?.balance ?? 0n)).toFixed(6),
    };
  }

  async fetchToken(token: Token, wallet: OmniWallet) {
    const key = `${wallet.type}:${wallet.address}`;

    if (token.type === WalletType.OMNI) {
      const balances = await Intents.getIntentsBalances([token.address], wallet.omniAddress);
      runInAction(() => (this.balances[key][token.id] = balances[token.address]));
      return balances[token.address] ?? 0n;
    }

    if (token.type === wallet.type) {
      const balance = await wallet.fetchBalance(token.chain, token.address);
      runInAction(() => (this.balances[key][token.id] = balance));
      return balance;
    }

    return 0n;
  }

  async fetchOmniTokens(wallet: OmniWallet) {
    const key = `${wallet.type}:${wallet.address}`;
    const assets = await wallet.getAssets();
    runInAction(() => {
      Object.keys(assets).forEach((id) => {
        this.balances[key][`-4:${id}`] = assets[id];
      });
    });
  }

  async fetchTokens(wallet: OmniWallet) {
    const key = `${wallet.type}:${wallet.address}`;
    if (!this.balances[key]) this.balances[key] = {};
    const tokens = this.tokens.filter((t) => t.type === wallet.type && t.type !== WalletType.OMNI);

    // Group tokens by their chain
    const groups: Record<number, string[]> = tokens.reduce((acc, token) => {
      if (!acc[token.chain]) acc[token.chain] = [];
      acc[token.chain].push(token.address);
      return acc;
    }, {} as Record<number, string[]>);

    Object.entries(groups).forEach(async ([chain, tokens]) => {
      const balances = await wallet.fetchBalances(+chain, tokens);
      console.log(chain, balances);
      runInAction(() => {
        for (const [token, balance] of Object.entries(balances)) {
          this.balances[key][`${chain}:${token}`] = balance;
        }
      });
    });
  }

  async requestToken(token: OmniToken, amount: bigint | number): Promise<{ wallet: OmniWallet; token: Token; amount: bigint }> {
    if (!token) throw new Error("Token not found");
    const ftToken = this.tokens.find((t) => t.address === token)!;
    const amountInt = typeof amount === "number" ? ftToken.int(amount) : amount;
    const [existed] = this.walletsTokens.filter((t) => t.token.id === ftToken.id);

    if (existed?.balance >= amountInt) return { token: ftToken, wallet: existed.wallet, amount: amountInt };

    const needed = amountInt - (existed?.balance ?? 0n);
    const result = await openPayment(this, ftToken, needed, Recipient.fromWallet(existed?.wallet));

    const recipientWallet = this.wallets.find((w) => w.address === result.recipient.address);
    if (!recipientWallet) throw new Error("Recipient not found");
    const exist = await this.fetchToken(ftToken, recipientWallet);

    return {
      token: result.to,
      wallet: recipientWallet,
      amount: formatter.bigIntMin(exist, amountInt),
    };
  }

  onConnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async withdraw(token: OmniToken, amount: number, settings?: { title?: string; sender?: OmniWallet }) {
    const omniToken = this.tokens.find((t) => t.address === token)!;
    const originalToken = this.tokens.find((t) => t.chain === omniToken.originalChain && t.address === omniToken.originalAddress)!;
    const recipient = Recipient.fromWallet(this.wallets.find((w) => w.type === originalToken.type));

    const sender =
      settings?.sender ||
      this.wallets.sort((a, b) => {
        const aBalance = omniToken.float(this.balance(a, omniToken));
        const bBalance = omniToken.float(this.balance(b, omniToken));
        return bBalance - aBalance;
      })[0];

    return openBridge(this, {
      //  title: settings?.title,
      sender: sender,
      recipient: recipient,
      to: originalToken,
      from: omniToken,
      amount: amount,
    });
  }

  async deposit(token: OmniToken, amount: number, settings?: { title?: string }) {
    const omni = this.tokens.find((t) => t.address === token)!;
    const orig = this.tokens.find((t) => t.chain === omni.originalChain && t.address === omni.originalAddress)!;
    const sender = this.wallets.find((t) => t.type === orig.type)!;
    const recipient = Recipient.fromWallet(this.wallets.find((w) => !!w.omniAddress));

    return openBridge(this, {
      sender: sender,
      type: "exactOut",
      readonlyAmount: true,
      readonlyTo: true,
      title: settings?.title,
      recipient: recipient,
      amount: amount,
      from: orig,
      to: omni,
    });
  }

  async openBridge() {
    await openBridge(this);
  }

  async connect(type?: WalletType) {
    if (this.wallets.length > 0) return openProfile(this);
    if (!type) return openConnector(this);

    const connector = this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type));
    if (!connector) throw new Error("Connector not found");
    return openWalletPicker(connector);
  }
}
