import { NearWalletBase, SignMessageParams, SignedMessage, SignAndSendTransactionParams, SignAndSendTransactionsParams } from "@hot-labs/near-connect";
import { base64, base58 } from "@scure/base";
import crypto from "crypto";

import { OmniWallet } from "../core/OmniWallet";
import { Network, WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";
import { Commitment } from "../core";

import { rpc, TGAS } from "./rpc";
import { createNearWallet } from "./standalone";

export default class NearWallet extends OmniWallet {
  readonly icon = "https://storage.herewallet.app/upload/73a44e583769f11112b0eff1f2dd2a560c05eed5f6d92f0c03484fa047c31668.png";
  readonly type = WalletType.NEAR;

  static fromPrivateKey(privateKey: Buffer, address?: string) {
    return createNearWallet(privateKey, address);
  }

  constructor(readonly address: string, readonly publicKey?: string, readonly wallet?: NearWalletBase) {
    super();
  }

  get omniAddress() {
    return this.address;
  }

  async fetchBalances(chain: number, whitelist: string[] = []): Promise<Record<string, bigint>> {
    if (chain === Network.Omni) return await super.fetchBalances(chain, whitelist);
    try {
      return await super.fetchBalances(chain, whitelist);
    } catch (error) {
      const tasks = whitelist.map(async (token) => [token, await this.fetchBalance(chain, token)]);
      return Object.fromEntries(await Promise.all(tasks));
    }
  }

  async sendTransactions(params: SignAndSendTransactionsParams): Promise<string[]> {
    if (!this.wallet) throw "not impl";
    const result = await this.wallet.signAndSendTransactions(params);
    return result.map((tx) => tx.transaction.hash);
  }

  async sendTransaction(params: SignAndSendTransactionParams): Promise<string> {
    if (!this.wallet) throw "not impl";
    const result = await this.wallet.signAndSendTransaction(params);
    return result.transaction.hash;
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
    if (!this.wallet) throw "not impl";
    return this.wallet.signMessage(params);
  }

  public async getWrapNearDepositAction(amount: bigint, address: string) {
    const storage = await rpc.viewMethod({
      contractId: "wrap.near",
      methodName: "storage_balance_of",
      args: { account_id: address },
    });

    const depositAction = {
      type: "FunctionCall",
      params: {
        methodName: "near_deposit",
        deposit: String(amount),
        gas: String(50n * TGAS),
        args: {},
      },
    };

    if (storage != null) return [depositAction];
    return [
      {
        type: "FunctionCall",
        params: {
          gas: 30n * TGAS,
          methodName: "storage_deposit",
          deposit: `12500000000000000000000`,
          args: { account_id: address, registration_only: true },
        },
      },
      depositAction,
    ];
  }

  async needRegisterToken(token: string, address: string): Promise<boolean> {
    if (token === "native") return false;
    const storage = await rpc.viewMethod({ contractId: token, methodName: "storage_balance_of", args: { account_id: address } }).catch(() => null);
    return storage == null;
  }

  async registerToken(token: string) {
    const isNeedRegister = await this.needRegisterToken(token, this.address);
    if (!isNeedRegister) return;

    await this.sendTransaction({
      receiverId: token,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "storage_deposit",
            args: { account_id: this.address, registration_only: true },
            deposit: `12500000000000000000000`,
            gas: String(30n * TGAS),
          },
        },
      ],
    });
  }

  async transferFee() {
    return new ReviewFee({ baseFee: 0n, gasLimit: 300n * TGAS, chain: 1010 });
  }

  async fetchBalance(chain: number, address: string) {
    if (chain !== 1010) return super.fetchBalance(chain, address);

    if (address === "native") {
      const protocolConfig = await rpc.experimental_protocolConfig({ finality: "near-final" });
      const state = await rpc.viewAccount(this.address, { finality: "near-final" });
      const costPerByte = BigInt(protocolConfig.runtime_config.storage_amount_per_byte);
      const usedOnStorage = BigInt(state.storage_usage) * costPerByte;
      const locked = BigInt(state.locked);
      const total = BigInt(state.amount) + locked;
      const available = total - (locked > usedOnStorage ? locked : usedOnStorage);
      return this.setBalance(`${chain}:${address}`, available < 0n ? 0n : available);
    }

    const balance = await rpc.viewMethod({
      args: { account_id: this.address },
      contractId: address,
      methodName: "ft_balance_of",
    });

    return this.setBalance(`${chain}:${address}`, BigInt(balance));
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }) {
    if (args.token.address === "native") {
      return await this.sendTransaction({
        actions: [{ type: "Transfer", params: { deposit: String(args.amount) } }],
        receiverId: args.receiver,
      });
    }

    const actions: any[] = [
      {
        type: "FunctionCall",
        params: {
          methodName: "ft_transfer",
          args: { receiver_id: args.receiver, amount: String(args.amount) },
          gas: String(30n * TGAS),
          deposit: String(1n),
        },
      },
    ];

    const needRegister = await this.needRegisterToken(args.token.address, args.receiver);
    if (needRegister)
      actions.unshift({
        type: "FunctionCall",
        params: {
          gas: String(30n * TGAS),
          methodName: "storage_deposit",
          deposit: `12500000000000000000000`,
          args: { account_id: args.receiver, registration_only: true },
        },
      });

    return await this.sendTransaction({ receiverId: args.token.address, actions });
  }

  async isIntentAccountRegistered(publicKey: string) {
    const keys = await rpc.viewMethod({
      contractId: "intents.near",
      methodName: "public_keys_of",
      args: { account_id: this.address },
    });

    const list = keys.map((t: string) => t.split(":")[1].toLowerCase());
    return list.includes(publicKey.split(":")[1].toLowerCase());
  }

  async registerIntentAccountIfNeeded(publicKey: string) {
    let isRegistered = await this.isIntentAccountRegistered(publicKey);
    if (isRegistered) return;

    await this.sendTransaction({
      receiverId: "intents.near",
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "add_public_key",
            args: { public_key: publicKey },
            gas: String(80n * TGAS),
            deposit: String(1n),
          },
        },
      ],
    }).catch(() => null);

    isRegistered = await this.isIntentAccountRegistered(publicKey);
    if (isRegistered) return;

    throw new Error("Failed to register intent account");
  }

  async signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number; signerId?: string }): Promise<Commitment> {
    if (!this.wallet) throw "not impl";

    const nonce = new Uint8Array(options?.nonce || crypto.randomBytes(32));
    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      signer_id: options?.signerId || this.omniAddress,
      intents: intents,
    });

    const result = await this.wallet.signMessage({ message, recipient: "intents.near", nonce });
    if (!result) throw new Error("Failed to sign message");
    const { signature, publicKey } = result;

    await this.registerIntentAccountIfNeeded(publicKey);

    return {
      standard: "nep413",
      payload: { nonce: base64.encode(nonce), recipient: "intents.near", message },
      signature: signature.includes("ed25519:") ? signature : `ed25519:${base58.encode(base64.decode(signature))}`,
      public_key: publicKey,
    };
  }
}
