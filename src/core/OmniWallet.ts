import { hex } from "@scure/base";
import { action, makeObservable, observable } from "mobx";

import type { HotKit } from "../HotKit";
import { Network, OmniToken, WalletType } from "./chains";
import { Commitment } from "./types";
import { Intents } from "./Intents";
import { ReviewFee } from "./bridge";
import { Token } from "./token";
import { api } from "./api";

export abstract class OmniWallet {
  balances: Record<string, bigint> = {};
  kit?: HotKit;

  abstract address: string;
  abstract publicKey?: string;
  abstract omniAddress: string;
  abstract type: WalletType;
  abstract icon: string;

  constructor() {
    makeObservable(this, { balances: observable, setBalance: action });
  }

  intents(kit?: HotKit) {
    return new Intents(kit).attachWallet(this);
  }

  setBalance(id: string, balance: bigint) {
    this.balances[id] = balance;
    return balance;
  }

  getBalance(id: string) {
    return this.balances[id] ?? 0n;
  }

  async depositNfts(nftIds: string[], receiver: string) {
    throw new Error("Method not implemented.");
  }

  async getDepositNftsFee(nfts: string[]) {
    return new ReviewFee({ chain: -4 });
  }

  async withdrawNfts(nftIds: string[], receiver: string) {
    throw new Error("Method not implemented.");
  }

  async transferNft(nftId: string, receiver: string) {
    throw new Error("Method not implemented.");
  }

  async sendTransaction(tx: any): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async getTranferNftFee(nftId: string, receiver: string) {
    return new ReviewFee({ chain: -4 });
  }

  async getNfts(onLoad: (nfts: string[]) => void) {}

  async transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee> {
    return new ReviewFee({ chain: -4 });
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (args.token.chain !== Network.Omni) throw new Error("Invalid token chain");
    return await this.intents()
      .transfer({ amount: args.amount, recipient: args.receiver, token: args.token.omniAddress as OmniToken })
      .execute();
  }

  async fetchBalance(chain: number, address: string): Promise<bigint> {
    if (chain !== Network.Omni) return 0n;
    if (!this.omniAddress) return 0n;

    const balances = await Intents.getIntentsBalances([address], this.omniAddress);
    return this.setBalance(`${chain}:${address}`, balances[address] || 0n);
  }

  async fetchBalances(chain: number, whitelist: string[] = []): Promise<Record<string, bigint>> {
    if (chain === Network.Omni) {
      if (!this.omniAddress) return {};
      const list = whitelist.length > 0 ? whitelist : await Intents.getIntentsAssets(this.omniAddress);
      const balances = await Intents.getIntentsBalances(list, this.omniAddress);
      Object.entries(balances).forEach(([address, balance]) => this.setBalance(`${chain}:${address}`, BigInt(balance as unknown as string)));
      return balances;
    }

    const res = await fetch(`https://api0.herewallet.app/api/v1/user/balances/${chain}/${this.address}`, { body: JSON.stringify({ whitelist }), method: "POST" });
    const { balances } = await res.json();

    if (Object.keys(balances).length === 0) throw "No balances found";
    Object.entries(balances).forEach(([address, balance]) => this.setBalance(`${chain}:${address}`, BigInt(balance as string)));
    const native = await this.fetchBalance(chain, "native").catch(() => 0n);
    return { ...balances, native };
  }

  async signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number; signerId?: string }): Promise<Commitment> {
    throw new Error("Method not implemented.");
  }

  async auth<T = string>(intents?: Record<string, any>[], options?: { domain?: string; signerId?: string; customAuth?: (commitment: Commitment, seed: string) => Promise<T> }): Promise<T> {
    const authFn = async () => {
      const seed = hex.encode(new Uint8Array(window.crypto.getRandomValues(new Uint8Array(32))));
      const msgBuffer = new TextEncoder().encode(`${options?.domain || window.location.origin}_${seed}`);
      const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));
      const signed = await this.signIntents(intents || [], { nonce: new Uint8Array(nonce), signerId: options?.signerId || this.omniAddress });

      if (options?.customAuth) return await options.customAuth(signed, seed);
      return (await api.auth(signed, seed)) as T;
    };

    if (this.kit == null) return await authFn();
    return this.kit.router.openAuthPopup(this, authFn);
  }

  async waitUntilOmniBalance(need: Record<string, bigint>, receiver = this.omniAddress, attempts = 0) {
    if (attempts > 120) throw "Balance is not enough";
    const assets = Object.keys(need) as string[];
    const balances = await Intents.getIntentsBalances(assets, receiver);
    if (assets.every((asset) => (balances[asset] || 0n) >= (need[asset] || 0n))) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.waitUntilOmniBalance(need, receiver, attempts + 1);
  }
}
