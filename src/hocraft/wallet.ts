import crypto from "node:crypto";
import { base32crockford, base58, base64 } from "@scure/base";
import { KeyPair, KeyPairString } from "@near-js/crypto";

import { Commitment, Intents, Network, OmniToken, OmniWallet, ReviewFee, Token, WalletType } from "../core";
import { AutoQueue } from "../core/utils";
import { DataStorage } from "../storage";
import { rpc } from "../near/rpc";

export const TGAS = 1_000_000_000_000n;

class HotCraftAccount extends OmniWallet {
  publicKey?: string | undefined;
  type = WalletType.HotCraft;
  omniAddress: string;
  address: string;

  constructor(readonly wallet: OmniWallet, readonly storage: DataStorage) {
    super();
    this.omniAddress = HotCraftAccount.getTradingAddress(wallet.omniAddress);
    this.address = this.omniAddress;
  }

  get icon() {
    return this.wallet.icon;
  }

  async getTradingKey() {
    const tradingKey = await this.storage.get(`hotcraft:${this.omniAddress}:key`);
    if (tradingKey) return KeyPair.fromString(tradingKey as KeyPairString);

    const newTradingKey = KeyPair.fromRandom("ed25519");
    await this.storage.set(`hotcraft:${this.omniAddress}:key`, newTradingKey.toString());
    return newTradingKey;
  }

  static getTradingAddress(signerId: string) {
    const buffer = crypto.createHash("sha256").update(Buffer.from(signerId, "utf8")).digest();
    const hash = base32crockford.encode(buffer.slice(0, 20)).toLowerCase();
    return `${hash}.craft.tg`;
  }

  async getAuthCommitment({ forceRegister = false }: { forceRegister?: boolean } = {}) {
    const tradingKey = await this.getTradingKey();
    const commitment = await this.storage.get(`hotcraft:${this.omniAddress}:auth`);

    try {
      if (!commitment || forceRegister) throw new Error("No credentials found");
      if (!commitment.includes(tradingKey.getPublicKey().toString())) throw "Invalid commitment";
      return JSON.parse(commitment) as Commitment;
    } catch (error) {
      const commitment = await this.wallet
        .intents()
        .authCall({
          contractId: "craft.tg",
          attachNear: 0n,
          tgas: 250,
          msg: JSON.stringify({
            public_key: tradingKey.getPublicKey().toString(),
            force_register: forceRegister,
            referral: "hotcraft.art",
          }),
        })
        .sign();

      await this.storage.set(`hotcraft:${this.omniAddress}:auth`, JSON.stringify(commitment));
      return commitment;
    }
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (args.token.chain !== Network.HotCraft) throw new Error("Invalid token chain");
    return await this.intents()
      .transfer({ amount: args.amount, recipient: args.receiver, token: args.token.omniAddress as OmniToken })
      .execute();
  }

  _isRegistered = false;
  async isRegistered() {
    if (this._isRegistered) return true;
    const tradingKey = await this.getTradingKey();
    const result = await rpc.viewMethod({
      args: { account_id: this.omniAddress, public_key: tradingKey.getPublicKey().toString() },
      methodName: "has_public_key",
      contractId: "intents.near",
    });

    this._isRegistered = result;
    return this._isRegistered;
  }

  async doubleCheckRegister() {
    if (await this.isRegistered()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await this.isRegistered();
  }

  async fetchBalance(chain: number, address: string): Promise<bigint> {
    if (chain !== Network.HotCraft) return 0n;
    if (!this.omniAddress) return 0n;
    const balances = await Intents.getIntentsBalances([address], this.omniAddress);
    return this.setBalance(`${Network.HotCraft}:${address}`, balances[address] || 0n);
  }

  async fetchBalances(chain: number, whitelist: string[] = []): Promise<Record<string, bigint>> {
    if (chain !== Network.HotCraft) return {};
    if (!this.omniAddress) return {};

    const list = whitelist.length > 0 ? whitelist : await Intents.getIntentsAssets(this.omniAddress);
    const balances = await Intents.getIntentsBalances(list, this.omniAddress);
    Object.entries(balances).forEach(([address, balance]) => this.setBalance(`${Network.HotCraft}:${address}`, BigInt(balance as unknown as string)));
    return balances;
  }

  private queue = new AutoQueue();
  async registerAccount(): Promise<KeyPair> {
    return await this.queue.enqueue<KeyPair>(async () => {
      const tradingKey = await this.getTradingKey();
      try {
        if (await this.isRegistered()) return tradingKey;
        const commitment = await this.getAuthCommitment();
        console.log("commitment", commitment);

        await Intents.publish([commitment]);

        if (await this.doubleCheckRegister()) return tradingKey;
        throw "We can't register your account, please try reconnect wallet";
      } catch (error) {
        if (await this.doubleCheckRegister()) return tradingKey;
        if (!error?.toString()?.includes?.("AccountDoesNotExist")) {
          throw "We can't register your account, please try reconnect wallet";
        }

        const commitment = await this.getAuthCommitment({ forceRegister: true });
        console.log("commitment", commitment);

        await Intents.publish([commitment]);
        return await this.registerAccount();
      }
    });
  }

  async signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number; signerId?: string }): Promise<Commitment> {
    const tradingKey = await this.registerAccount();
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      signer_id: options?.signerId || this.omniAddress,
      verifying_contract: "intents.near",
      nonce: base64.encode(nonce),
      intents: intents,
    });

    const signature = tradingKey.sign(Buffer.from(message, "utf8"));

    return {
      standard: "raw_ed25519",
      payload: message,
      signature: "ed25519:" + base58.encode(signature.signature),
      public_key: tradingKey.getPublicKey().toString(),
    };
  }
}

export default HotCraftAccount;
