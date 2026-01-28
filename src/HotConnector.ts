import { computed, makeObservable } from "mobx";

import packageJson from "../package.json";

import { Exchange } from "./core/exchange";
import { Telemetry } from "./core/telemetry";
import { OmniWallet } from "./core/OmniWallet";
import { ChainConfig, chains, Network, WalletType } from "./core/chains";
import { EventEmitter } from "./core/events";
import { Recipient } from "./core/recipient";
import { OmniToken } from "./core/chains";
import { Intents } from "./core/Intents";
import { tokens } from "./core/tokens";
import { Token } from "./core/token";
import { api } from "./core/api";
import { rpc } from "./near/rpc";

import { defaultConnectors } from "./defaults";
import type CosmosWallet from "./cosmos/wallet";
import type NearWallet from "./near/wallet";
import type EvmWallet from "./evm/wallet";
import type SolanaWallet from "./solana/wallet";
import type StellarWallet from "./stellar/wallet";
import type TonWallet from "./ton/wallet";

import { openBridge, openConnector, openProfile, openWalletPicker } from "./ui/router";
import { ConnectorType, OmniConnector } from "./core/OmniConnector";
import { DataStorage, LocalStorage } from "./storage";
import { Activity } from "./activity";

interface HotConnectorOptions {
  apiKey: string;
  storage?: DataStorage;
  chains?: Record<number, ChainConfig>;
  connectors?: (((wibe3: HotConnector) => Promise<OmniConnector>) | null | undefined)[];
  walletConnect?: {
    projectId?: string;
    metadata?: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
}

export class HotConnector {
  public storage: DataStorage;
  public connectors: OmniConnector[] = [];
  public telemetry: Telemetry;
  public exchange: Exchange;

  public activity: Activity;
  public version = packageJson.version;

  private events = new EventEmitter<{
    connect: { wallet: OmniWallet; connector: OmniConnector };
    disconnect: { wallet: OmniWallet; connector: OmniConnector };
    tokensUpdate: { tokens: Token[] };
  }>();

  public settings: {
    webWallet: string;
    projectId?: string;
    metadata?: { name: string; description: string; url: string; icons: string[] };
  } = { webWallet: "https://app.hot-labs.org" };

  constructor(options?: HotConnectorOptions) {
    makeObservable(this, {
      priorityWallet: computed,
      walletsTokens: computed,
      wallets: computed,
      tokens: computed,

      near: computed,
      evm: computed,
      solana: computed,
      stellar: computed,
      ton: computed,
      cosmos: computed,
    });

    api.apiKey = options?.apiKey ?? "";
    this.settings.projectId = options?.walletConnect?.projectId ?? undefined;
    this.settings.metadata = options?.walletConnect?.metadata ?? undefined;
    Object.values(options?.chains ?? {}).forEach((chain) => chains.register(chain));

    this.storage = options?.storage ?? new LocalStorage();
    this.telemetry = new Telemetry(this);
    this.activity = new Activity(this);
    this.exchange = new Exchange();

    const connectors: OmniConnector[] = [];
    const configConnectors = options?.connectors || defaultConnectors;
    const tasks = configConnectors.map(async (initConnector, index) => {
      if (!initConnector) return;
      const connector = await initConnector(this);
      connector.onConnect((payload) => this.events.emit("connect", payload));
      connector.onDisconnect((payload) => this.events.emit("disconnect", payload));
      connectors[index] = connector;
    });

    Promise.all(tasks ?? []).then(() => {
      this.connectors = connectors.filter((t) => t != null);
    });

    this.connectors.forEach((t) => {
      t.onConnect((payload) => this.events.emit("connect", payload));
      t.onDisconnect((payload) => this.events.emit("disconnect", payload));
    });

    this.onConnect((payload) => {
      payload.wallet.fetchBalances(Network.Omni);
      this.fetchTokens(payload.wallet);
    });

    tokens.startTokenPolling();
  }

  setOmniChainBranding(branding: { name: string; icon: string }) {
    chains.get(Network.Omni).name = branding.name;
    chains.get(Network.Omni).logo = branding.icon;
  }

  getWalletConnector(type: WalletType): OmniConnector | null {
    return this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type)) ?? null;
  }

  omni(token: OmniToken) {
    return tokens.get(token);
  }

  get tokens() {
    return tokens.list;
  }

  get priorityWallet() {
    if (this.near) return this.near;
    if (this.evm) return this.evm;
    if (this.solana) return this.solana;
    if (this.ton) return this.ton;
    if (this.stellar) return this.stellar;
  }

  get wallets(): OmniWallet[] {
    return this.connectors.flatMap((t) => t.wallets);
  }

  get walletsTokens() {
    return this.wallets
      .flatMap((wallet) => {
        return tokens.list.map((token) => ({ token, wallet, balance: this.balance(wallet, token) }));
      })
      .filter((t) => t.balance !== 0n)
      .sort((a, b) => {
        const balanceA = a.token.float(a.balance) * a.token.usd;
        const balanceB = b.token.float(b.balance) * b.token.usd;
        return balanceB - balanceA;
      });
  }

  get nearRpc() {
    return rpc;
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

  isCosmosWallet(wallet?: OmniWallet): wallet is CosmosWallet {
    return wallet?.type === WalletType.COSMOS;
  }

  isEvmWallet(wallet?: OmniWallet): wallet is EvmWallet {
    return wallet?.type === WalletType.EVM;
  }

  isSolanaWallet(wallet?: OmniWallet): wallet is SolanaWallet {
    return wallet?.type === WalletType.SOLANA;
  }

  isStellarWallet(wallet?: OmniWallet): wallet is StellarWallet {
    return wallet?.type === WalletType.STELLAR;
  }

  isTonWallet(wallet?: OmniWallet): wallet is TonWallet {
    return wallet?.type === WalletType.TON;
  }

  isNearWallet(wallet?: OmniWallet): wallet is NearWallet {
    return wallet?.type === WalletType.NEAR;
  }

  getChainBalances(chain: number) {
    return tokens.list
      .filter((t) => t.chain === chain)
      .reduce((acc: number, token: Token) => {
        return this.wallets.reduce((acc: number, wallet) => {
          if (token.chain === chain) return acc;
          const balance = wallet.getBalance(token.id);
          return acc + token.float(balance) * token.usd;
        }, acc);
      }, 0);
  }

  balance(wallet?: OmniWallet, token?: Token) {
    if (!wallet || !token) return 0n;
    return wallet.getBalance(token.id);
  }

  availableBalance(token: OmniToken) {
    const omni = tokens.get(token);
    const omniBalance = this.balance(this.priorityWallet, omni);

    const getAvailableBalance = (token: { token: Token; wallet: OmniWallet; balance: bigint }) => {
      const balance = token.token.float(token.balance);
      const amount = Math.max(0, token.token.float(token.balance) - token.token.reserve);
      let available = amount;

      if (token.token.type !== WalletType.COSMOS) available = amount * 0.99; // Slippage protection
      return { token: token.token, wallet: token.wallet, balance, available };
    };

    const onchainTokens = this.walletsTokens.filter((t) => t.token.type !== WalletType.OMNI && t.token.originalId === omni.originalId);
    if (onchainTokens.length === 0) return { token: omni, omni: omniBalance, onchain: 0n, available: omni.float(omniBalance) };

    const onchainToken = onchainTokens.reduce((max, t) => {
      const current = getAvailableBalance(t);
      return current.available > max.available ? current : max;
    }, getAvailableBalance(onchainTokens[0]));

    return {
      token: omni,
      omni: omniBalance,
      onchain: onchainToken.token.int(onchainToken?.balance ?? 0),
      available: omni.float(omniBalance) + (onchainToken?.available ?? 0),
    };
  }

  async fetchToken(token: Token, wallet: OmniWallet) {
    return await wallet.fetchBalance(token.chain, token.address);
  }

  async fetchTokens(wallet: OmniWallet) {
    const tokensList = (await tokens.getTokens()).filter((t) => t.type === wallet.type && t.type !== WalletType.OMNI);

    // Group tokens by their chain
    const groups: Record<number, string[]> = tokensList.reduce((acc, token) => {
      if (!acc[token.chain]) acc[token.chain] = [];
      acc[token.chain].push(token.address);
      return acc;
    }, {} as Record<number, string[]>);

    const tasks = Object.entries(groups).map(([chain, tokens]) => wallet.fetchBalances(+chain, tokens));
    await Promise.allSettled(tasks);
  }

  intentsBuilder(wallet?: OmniWallet) {
    return new Intents(this).attachWallet(wallet);
  }

  onConnect(handler: (payload: { wallet: OmniWallet; connector: OmniConnector }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: OmniWallet; connector: OmniConnector }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async withdraw(token: OmniToken, amount?: number, settings?: { sender?: OmniWallet }) {
    const tokensList = await tokens.getTokens();
    const omniToken = tokensList.find((t) => t.address === token)!;
    const originalToken = tokensList.find((t) => t.chain === omniToken.originalChain && t.address === omniToken.originalAddress)!;
    const recipient = Recipient.fromWallet(this.wallets.find((w) => w.type === originalToken.type));

    const sender =
      settings?.sender ||
      this.wallets.sort((a, b) => {
        const aBalance = omniToken.float(this.balance(a, omniToken));
        const bBalance = omniToken.float(this.balance(b, omniToken));
        return bBalance - aBalance;
      })[0];

    return openBridge(this, {
      mobileFullscreen: true,
      recipient: recipient,
      to: originalToken,
      from: omniToken,
      amount: amount,
      sender: sender,
    });
  }

  async deposit(token: OmniToken, amount?: number) {
    const tokensList = await tokens.getTokens();
    const omni = tokensList.find((t) => t.address === token)!;
    const orig = tokensList.find((t) => t.chain === omni.originalChain && t.address === omni.originalAddress)!;
    const sender = this.wallets.find((t) => t.type === orig.type)!;
    const recipient = Recipient.fromWallet(this.wallets.find((w) => !!w.omniAddress));

    return openBridge(this, {
      mobileFullscreen: true,
      sender: sender,
      type: "exactOut",
      readonlyAmount: !!amount,
      readonlyTo: true,
      recipient: recipient,
      amount: amount,
      from: orig,
      to: omni,
    });
  }

  async openBridge() {
    await openBridge(this);
  }

  async openProfile() {
    openProfile(this);
  }

  async connect(type?: WalletType) {
    if (!type) return openConnector(this);
    const connector = this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type));
    if (!connector) throw new Error("Connector not found");
    return openWalletPicker(connector);
  }

  async disconnect(wallet: WalletType | OmniWallet) {
    const connector = this.connectors.find((t) => {
      if (wallet instanceof OmniWallet) return t.wallets.includes(wallet);
      return t.walletTypes.includes(wallet);
    });

    if (!connector) throw new Error("Connector not found");
    await connector.disconnect();
  }
}
