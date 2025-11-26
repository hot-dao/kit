import { sha256 } from "@noble/hashes/sha2.js";

import { OmniToken, WalletType } from "./config";
import { openAuthPopup } from "../ui/connect/AuthPopup";
import { OmniConnector } from "./OmniConnector";
import IntentsBuilder from "./builder";
import { Intents } from "./Intents";
import { ReviewFee } from "./fee";
import { Token } from "./token";

export interface AuthCommitment {
  tradingAddress: string;
  signed: Record<string, any>;
  address: string;
  publicKey: string;
  chainId: WalletType;
  seed: string;
}

export interface SignedAuth {
  signed: Record<string, any>;
  address: string;
  publicKey: string;
  chainId: WalletType;
  seed: string;
}

export abstract class OmniWallet {
  constructor(readonly connector?: OmniConnector) {}

  abstract address: string;
  abstract publicKey?: string;
  abstract omniAddress: string;
  abstract type: WalletType;

  async disconnect({ silent = false }: { silent?: boolean } = {}) {
    if (!this.connector) throw new Error("Connector not implemented");
    await this.connector.disconnect({ silent });
  }

  abstract transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee>;
  abstract transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string>;

  abstract signIntentsWithAuth(domain: string, intents?: Record<string, any>[]): Promise<SignedAuth>;
  abstract signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number }): Promise<Record<string, any>>;

  abstract fetchBalance(chain: number, address: string): Promise<bigint>;

  async executeIntents(intents: Record<string, any>[], hashes: string[] = []) {
    const signed = await this.signIntents(intents);
    return await Intents.publishSignedIntents([signed], hashes);
  }

  async validateAuth(auth: AuthCommitment) {
    return true;
  }

  get icon() {
    return this.connector?.icon;
  }

  get intents() {
    return new IntentsBuilder().attachWallet(this);
  }

  async pay({ token, amount, recipient, paymentId }: { token: OmniToken; amount: number; recipient: string; paymentId: string }) {
    const nonce = new Uint8Array(sha256(new TextEncoder().encode(paymentId))).slice(0, 32);
    return this.intents.attachNonce(nonce).transfer({ recipient, token, amount }).execute();
  }

  async auth<T = SignedAuth>(domain: string, intents?: Record<string, any>[], then?: (signed: SignedAuth) => Promise<T>): Promise<T> {
    return openAuthPopup<T>(this, async () => {
      const signed = await this.signIntentsWithAuth(domain, intents);
      return (await then?.(signed)) ?? (signed as T);
    });
  }

  async waitUntilBalance(need: Record<string, bigint>, receiver: string, attempts = 0) {
    if (attempts > 120) throw "Balance is not enough";
    const assets = Object.keys(need) as string[];
    const balances = await Intents.getIntentsBalances(assets, receiver);
    if (assets.every((asset) => (balances[asset] || 0n) >= (need[asset] || 0n))) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.waitUntilBalance(need, receiver, attempts + 1);
  }

  async getIntentsBalance(asset: string, receiver: string): Promise<bigint> {
    const balances = await Intents.getIntentsBalances([asset], receiver);
    return balances[asset] || 0n;
  }

  async getAssets() {
    if (!this.omniAddress) return {};
    const assets = await Intents.getIntentsAssets(this.omniAddress);
    const balances = await Intents.getIntentsBalances(assets, this.omniAddress);
    return balances;
  }
}
