import { base58, base64, hex } from "@scure/base";

import type { OmniConnector } from "../core/OmniConnector";
import { OmniWallet } from "../core/OmniWallet";
import { Network, WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";
import { Commitment } from "../core";

interface TronWebLike {
  ready?: boolean;
  defaultAddress?: { base58?: string; hex?: string };
  address?: { toHex?: (address: string) => string };
  trx?: {
    getBalance?: (address: string) => Promise<number | string>;
    sendTransaction?: (to: string, amount: number | string) => Promise<any>;
    signMessageV2?: (message: string) => Promise<string>;
    signMessage?: (message: string) => Promise<string>;
  };
  contract?: () => { at: (address: string) => Promise<any> };
}

class TronWallet extends OmniWallet {
  readonly publicKey?: string;
  readonly type = WalletType.Tron;

  constructor(readonly connector: OmniConnector, readonly address: string, readonly tronWeb: TronWebLike) {
    super();
  }

  get icon() {
    return this.connector.icon;
  }

  get omniAddress() {
    // Convert TRON base58 address -> EVM-like hex (0x + 20 bytes) for signer_id.
    const hexAddrRaw =
      this.tronWeb.address?.toHex?.(this.address) || //
      this.tronWeb.defaultAddress?.hex ||
      "";

    const clean = hexAddrRaw.startsWith("0x") ? hexAddrRaw.slice(2) : hexAddrRaw;
    if (!clean) return this.address.toLowerCase();

    // Tron addresses are typically: 41 + 20 bytes (hex).
    if (clean.length >= 42 && clean.startsWith("41")) return `0x${clean.slice(2, 42)}`.toLowerCase();
    if (clean.length === 40) return `0x${clean}`.toLowerCase();
    return `0x${clean}`.toLowerCase();
  }

  private async trc20Balance(contractAddress: string): Promise<bigint> {
    if (!this.tronWeb.contract) throw new Error("TronLink not available");
    const contract = await this.tronWeb.contract().at(contractAddress);
    const res = await contract.balanceOf(this.address).call();
    const value = typeof res === "string" ? res : res?._hex ?? res?.toString?.() ?? "0";
    return BigInt(value);
  }

  async fetchBalance(chain: number, address: string): Promise<bigint> {
    if (chain !== Network.Tron) return super.fetchBalance(chain, address);
    if (!this.tronWeb.trx) throw new Error("TronLink not available");

    if (address === "native") {
      const balance = await this.tronWeb.trx.getBalance?.(this.address);
      return this.setBalance(`${chain}:${address}`, BigInt(balance || 0));
    }

    return this.setBalance(`${chain}:${address}`, await this.trc20Balance(address));
  }

  async fetchBalances(chain: number, whitelist: string[]): Promise<Record<string, bigint>> {
    if (chain === Network.Omni) return await super.fetchBalances(chain, whitelist);
    try {
      return await super.fetchBalances(chain, whitelist);
    } catch {
      const tasks = whitelist.map(async (token) => [token, await this.fetchBalance(chain, token)]);
      return Object.fromEntries(await Promise.all(tasks));
    }
  }

  async transferFee(token: Token): Promise<ReviewFee> {
    // Tron fees depend on bandwidth/energy; for UX we return "0" and let wallet handle it.
    return new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: token.chain });
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (!this.tronWeb.trx) throw new Error("TronLink not available");

    if (args.token.address === "native") {
      const result = await this.tronWeb.trx.sendTransaction?.(args.receiver, args.amount.toString());
      return result?.txid || result?.transaction?.txID || result?.txID || result?.id || "";
    }

    if (!this.tronWeb.contract) throw new Error("TronLink not available");
    const contract = await this.tronWeb.contract().at(args.token.address);
    const result = await contract.transfer(args.receiver, args.amount.toString()).send();
    return typeof result === "string" ? result : result?.txid || result?.transaction?.txID || result?.txID || "";
  }

  private async signMessageTIP191(message: string): Promise<Uint8Array> {
    if (!this.tronWeb.trx?.signMessageV2 && !this.tronWeb.trx?.signMessage) throw "not impl";
    const signatureHex = (await (this.tronWeb.trx.signMessageV2?.(message) || this.tronWeb.trx.signMessage?.(message))) as string;
    if (!signatureHex) throw new Error("Failed to sign message");

    const clean = signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex;
    if (clean.length < 130) throw new Error("Invalid signature");

    const rsv = clean.slice(0, 130);
    const v = parseInt(rsv.slice(128, 130), 16);
    const parity = v === 27 || v === 0 ? 0 : v === 28 || v === 1 ? 1 : v % 2;
    const normalized = rsv.slice(0, 128) + (parity === 0 ? "00" : "01");
    return hex.decode(normalized);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      nonce: base64.encode(nonce),
      intents: intents,
    });

    // TronLink signs messages using TIP-191 ("\x19TRON Signed Message:\n").
    const buffer = await this.signMessageTIP191(message);
    return {
      signature: `secp256k1:${base58.encode(buffer)}`,
      payload: message,
      standard: "tip191",
    };
  }
}

export default TronWallet;
