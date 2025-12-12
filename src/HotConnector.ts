import { computed, makeObservable, observable, runInAction } from "mobx";

import { ChainConfig, chains, Network, WalletType } from "./core/chains";
import { createHotBridge, HotBridge } from "./core/bridge";
import { EventEmitter } from "./core/events";
import { Recipient } from "./core/recipient";
import { OmniToken } from "./core/chains";
import { formatter } from "./core/utils";
import { Intents } from "./core/Intents";
import { tokens } from "./core/tokens";
import { rpc } from "./core/nearRpc";
import { Token } from "./core/token";
import { api } from "./core/api";

import type CosmosWallet from "./cosmos/wallet";
import type NearWallet from "./near/wallet";
import type EvmWallet from "./evm/wallet";
import type SolanaWallet from "./solana/wallet";
import type StellarWallet from "./stellar/wallet";
import type TonWallet from "./ton/wallet";

import { openBridge, openConnector, openPayment, openProfile, openWalletPicker } from "./ui/router";
import { ConnectorType, OmniConnector } from "./OmniConnector";
import { OmniWallet } from "./OmniWallet";
import { Exchange } from "./exchange";

interface HotConnectorOptions {
  apiKey: string;
  chains?: Record<number, ChainConfig>;
  connectors?: ((wibe3: HotConnector) => Promise<OmniConnector>)[];
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
  public connectors: OmniConnector[] = [];
  public balances: Record<string, Record<string, bigint>> = {};

  public hotBridge: HotBridge;
  public exchange: Exchange;

  private events = new EventEmitter<{
    connect: { wallet: OmniWallet };
    disconnect: { wallet: OmniWallet };
    tokensUpdate: { tokens: Token[] };
  }>();

  public settings: {
    webWallet: string;
    projectId?: string;
    metadata?: { name: string; description: string; url: string; icons: string[] };
  } = { webWallet: "https://app.hot-labs.org" };

  constructor(options?: HotConnectorOptions) {
    makeObservable(this, {
      balances: observable,

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

    this.hotBridge = createHotBridge();
    this.exchange = new Exchange(this);

    const connectors: OmniConnector[] = [];
    const tasks = options?.connectors?.map(async (initConnector, index) => {
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
      this.fetchTokens(payload.wallet);
      this.fetchOmniTokens(payload.wallet);
    });

    this.onDisconnect(({ wallet }) => {
      if (!wallet) return;
      runInAction(() => (this.balances[`${wallet.type}:${wallet.address}`] = {}));
    });

    tokens.startTokenPolling();
  }

  setOmniChainBranding(branding: { name: string; icon: string }) {
    chains.get(Network.Hot).name = branding.name;
    chains.get(Network.Hot).logo = branding.icon;
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
          const balance = this.balances[`${wallet.type}:${wallet.address}`][token.id] ?? 0n;
          return acc + token.float(balance) * token.usd;
        }, acc);
      }, 0);
  }

  balance(wallet?: OmniWallet, token?: Token) {
    if (!wallet || !token) return 0n;
    return this.balances[`${wallet.type}:${wallet.address}`]?.[token.id] ?? 0n;
  }

  omniBalance(token: OmniToken) {
    const omni = tokens.get(token);
    const omniToken = this.walletsTokens.find((t) => t.token.address === omni.address);
    const onchainToken = this.walletsTokens.find((t) => t.token.address === omni.originalAddress);

    const reseve = onchainToken ? onchainToken.token.int(onchainToken.token.reserve) : 0n;
    const available = onchainToken ? formatter.bigIntMax(0n, onchainToken.balance - reseve) : 0n;

    return {
      token: omni,
      onchain: available,
      omni: omniToken?.balance ?? 0n,
      total: +omni.float((omniToken?.balance ?? 0n) + available).toFixed(6),
    };
  }

  async fetchToken(token: Token, wallet: OmniWallet) {
    const key = `${wallet.type}:${wallet.address}`;

    if (token.type === WalletType.OMNI) {
      if (!wallet.omniAddress) return 0n;
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
    if (!this.balances[key]) runInAction(() => (this.balances[key] = {}));
    const tokensList = (await tokens.getTokens()).filter((t) => t.type === wallet.type && t.type !== WalletType.OMNI);

    // Group tokens by their chain
    const groups: Record<number, string[]> = tokensList.reduce((acc, token) => {
      if (!acc[token.chain]) acc[token.chain] = [];
      acc[token.chain].push(token.address);
      return acc;
    }, {} as Record<number, string[]>);

    Object.entries(groups).forEach(async ([chain, tokens]) => {
      const balances = await wallet.fetchBalances(+chain, tokens);
      runInAction(() => {
        for (const [token, balance] of Object.entries(balances)) {
          this.balances[key][`${chain}:${token}`] = balance;
        }
      });
    });
  }

  async requestToken(token: OmniToken, amount: bigint | number): Promise<{ wallet: OmniWallet; token: Token; amount: bigint }> {
    if (!token) throw new Error("Token not found");

    const tokensList = await tokens.getTokens();
    const ftToken = tokensList.find((t) => t.address === token)!;
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

  async connect(type?: WalletType) {
    if (this.wallets.length > 0) return openProfile(this);
    if (!type) return openConnector(this);

    const connector = this.connectors.find((t) => t.type === ConnectorType.WALLET && t.walletTypes.includes(type));
    if (!connector) throw new Error("Connector not found");
    return openWalletPicker(connector);
  }
}
