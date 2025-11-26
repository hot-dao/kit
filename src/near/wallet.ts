import { NearWalletBase, SignAndSendTransactionsParams, SignMessageParams, SignedMessage, SignAndSendTransactionParams } from "@hot-labs/near-connect";
import { base64, base58, hex } from "@scure/base";

import { OmniConnector } from "../omni/OmniConnector";
import { OmniWallet } from "../omni/OmniWallet";
import { WalletType } from "../omni/config";
import { ReviewFee } from "../omni/fee";
import { Token } from "../omni/token";
import { rpc, TGAS } from "./rpc";

export default class NearWallet extends OmniWallet {
  readonly type = WalletType.NEAR;

  constructor(readonly connector: OmniConnector, readonly address: string, readonly publicKey: string, readonly wallet: NearWalletBase) {
    super(connector);
  }

  get omniAddress() {
    return this.address;
  }

  get manifest() {
    return this.wallet.manifest;
  }

  async onDisconnect() {
    await this.wallet.signOut();
  }

  async sendTransaction(params: SignAndSendTransactionParams): Promise<string> {
    const result = await this.wallet.signAndSendTransaction(params);
    return result.transaction.hash;
  }

  async sendTransactions(params: SignAndSendTransactionsParams): Promise<Array<string>> {
    const result = await this.wallet.signAndSendTransactions(params);
    return result.map((r) => r.transaction.hash);
  }

  async signMessage(params: SignMessageParams): Promise<SignedMessage> {
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

  async depositToOmni(amount: bigint, ft: string, receiver?: string) {
    let depositWnear: any[] = [];
    if (ft === "native") depositWnear = await this.getWrapNearDepositAction(amount, this.address);
    const token = ft === "native" ? "wrap.near" : ft;
    const actions = [
      ...depositWnear,
      {
        type: "FunctionCall",
        params: {
          methodName: "ft_transfer_call",
          args: { amount: String(amount), receiver_id: "intents.near", msg: receiver || this.omniAddress },
          gas: String(80n * TGAS),
          deposit: String(1n),
        },
      },
    ];

    return await this.sendTransaction({ actions, receiverId: token });
  }

  async needRegisterToken(token: string, address: string): Promise<boolean> {
    const storage = await rpc
      .viewMethod({
        contractId: token,
        methodName: "storage_balance_of",
        args: { account_id: address },
      })
      .catch(() => null);
    return storage == null;
  }

  async transferFee() {
    return new ReviewFee({ baseFee: 0n, gasLimit: 300n * TGAS, chain: 1010 });
  }

  async fetchBalance(chain: number, address: string) {
    if (chain !== 1010) throw "Invalid chain";

    if (address === "native") {
      const protocolConfig = await rpc.experimental_protocolConfig({ finality: "near-final" });
      const state = await rpc.viewAccount(this.address, { finality: "near-final" });
      const costPerByte = BigInt(protocolConfig.runtime_config.storage_amount_per_byte);
      const usedOnStorage = BigInt(state.storage_usage) * costPerByte;
      const locked = BigInt(state.locked);
      const total = BigInt(state.amount) + locked;
      const available = total - (locked > usedOnStorage ? locked : usedOnStorage);
      return available;
    }

    const balance = await rpc.viewMethod({
      args: { account_id: this.address },
      contractId: address,
      methodName: "ft_balance_of",
    });

    return BigInt(balance);
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

  async signIntentsWithAuth(domain: string, intents?: Record<string, any>[]) {
    const accounts = await this.wallet.getAccounts();
    if (accounts.length === 0) throw new Error("No account found");
    const { accountId, publicKey } = accounts[0];

    const seed = hex.encode(window.crypto.getRandomValues(new Uint8Array(32)));
    const msgBuffer = new TextEncoder().encode(`${domain}_${seed}`);
    const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));

    return {
      signed: await this.signIntents(intents || [], { nonce: new Uint8Array(nonce) }),
      chainId: WalletType.NEAR,
      publicKey: publicKey,
      address: accountId,
      domain,
      seed,
    };
  }

  async signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number }): Promise<Record<string, any>> {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      signer_id: this.omniAddress,
      intents: intents,
    });

    const result = await this.wallet.signMessage({ message, recipient: "intents.near", nonce });
    if (!result) throw new Error("Failed to sign message");
    const { signature, publicKey } = result;

    return {
      standard: "nep413",
      payload: { nonce: base64.encode(nonce), recipient: "intents.near", message },
      signature: signature.includes("ed25519:") ? signature : `ed25519:${base58.encode(base64.decode(signature))}`,
      public_key: publicKey,
    };
  }
}
