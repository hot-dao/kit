import { base64, base58, hex, base32 } from "@scure/base";
import { Address, Asset, BASE_FEE, Claimant, Contract, Memo, nativeToScVal, Networks, Operation, TimeoutInfinite, Transaction, TransactionBuilder, xdr } from "@stellar/stellar-base";
import { rpc } from "@stellar/stellar-sdk";

import { Commitment } from "../core/types";
import { WalletType } from "../core/chains";
import { OmniWallet } from "../core/OmniWallet";
import { ReviewFee } from "../core/bridge";
import { formatter } from "../core/utils";
import { Network } from "../core/chains";
import { Token } from "../core/token";

interface ProtocolWallet {
  address: string;
  signTransaction?: (transaction: Transaction) => Promise<{ signedTxXdr: string }>;
  signMessage?: (message: string) => Promise<{ signedMessage: string }>;
  rpc: {
    callSoroban: (callback: (s: any) => Promise<any>) => Promise<any>;
    callHorizon: (callback: (h: any) => Promise<any>) => Promise<any>;
  };
}

export const ACCOUNT_FOR_SIMULATE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
export enum ASSET_CONTRACT_METHOD {
  GET_ALLOWANCE = "allowance",
  APPROVE_ALLOWANCE = "approve",
  GET_BALANCE = "balance",
  TRANSFER = "transfer",
  NAME = "name",
  BURN = "burn",
}

class StellarWallet extends OmniWallet {
  readonly icon = "https://storage.herewallet.app/upload/1469894e53ca248ac6adceb2194e6950a13a52d972beb378a20bce7815ba01a4.png";
  readonly type = WalletType.STELLAR;

  constructor(readonly wallet: ProtocolWallet) {
    super();
  }

  get address() {
    return this.wallet.address;
  }

  get publicKey() {
    const payload = base32.decode(this.address);
    return base58.encode(payload.slice(1, -2));
  }

  get omniAddress() {
    const payload = base32.decode(this.address);
    return hex.encode(payload.slice(1, -2));
  }

  async fetchBalances(chain: number): Promise<Record<string, bigint>> {
    console.log("fetchBalances", chain);
    if (chain === Network.Omni) return await super.fetchBalances(chain);
    try {
      const balances = await super.fetchBalances(chain);
      console.log("balances", balances);
      return balances;
    } catch (e) {
      console.log("error", e);
      const data = await fetch(`https://horizon.stellar.org/accounts/${this.address}`).then((res) => res.json());
      console.log("data", data);
      const balances: [string, bigint][] = data.balances?.map((ft: { asset_type: string; sponsor?: string | null; asset_code: string; asset_issuer: string; balance: string }) => {
        const asset = ft.asset_type === "native" ? Asset.native() : new Asset(ft.asset_code, ft.asset_issuer);
        const contractId = ft.asset_type === "native" ? "native" : asset.contractId(Networks.PUBLIC);

        if (contractId === "native") {
          const activatingReserve = ft.sponsor != null ? 0 : 1;
          const trustlines = data.balances.filter((t: any) => t.asset_type !== "native" && t.sponsor == null);
          const balance = BigInt(formatter.parseAmount(ft.balance, 7));
          const reserved = BigInt(formatter.parseAmount(activatingReserve + 0.5 * (trustlines.length + (data.num_sponsoring || 0)), 7));
          return [contractId, formatter.bigIntMax(0n, balance - BigInt(reserved))];
        }

        return [contractId, BigInt(formatter.parseAmount(ft.balance, 7))];
      });

      balances.forEach(([address, balance]) => this.setBalance(`${chain}:${address}`, balance));
      return Object.fromEntries(balances);
    }
  }

  async fetchBalance(chain: number, token: string): Promise<bigint> {
    if (chain !== Network.Stellar) return super.fetchBalance(chain, token);
    const balances = await this.fetchBalances(chain);
    return this.setBalance(`${chain}:${token}`, balances[token] || 0n);
  }

  async transferFee(token: Token): Promise<ReviewFee> {
    return new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: token.chain });
  }

  async emulateTransfer(token: string, receiver: string, amount: bigint, memo?: string): Promise<{ fee: ReviewFee; tx: Transaction }> {
    const asset = await this.getAssetFromContractId(token);
    const sendAmount = formatter.formatAmount(amount, 7);

    const account = await this.wallet.rpc.callSoroban((s) => s.getAccount(this.address));
    const baseFee = await this.wallet.rpc.callHorizon((h) => h.fetchBaseFee()).catch(() => +BASE_FEE);
    const builder = new TransactionBuilder(account, {
      memo: memo ? Memo.text(memo) : undefined,
      networkPassphrase: Networks.PUBLIC,
      fee: String(baseFee),
    }).setTimeout(TimeoutInfinite);

    if (receiver.startsWith("C")) {
      const contract = new Contract(asset.contractId(Networks.PUBLIC));
      const amountScVal = nativeToScVal(amount, { type: "i128" });
      builder.addOperation(
        contract.call(
          "transfer", //
          Address.fromString(this.address).toScVal(),
          Address.fromString(receiver).toScVal(),
          amountScVal
        )
      );

      const tx = await this.wallet.rpc.callSoroban((s) => s.prepareTransaction(builder.build() as any));
      const fee = BigInt(Math.floor(baseFee * tx.operations.length));
      return { fee: new ReviewFee({ baseFee: fee, priorityFee: 0n, gasLimit: 1n, chain: Network.Stellar }), tx: tx as unknown as Transaction };
    }

    let needXlm = 0;
    const receiverAccount = await this.wallet.rpc.callHorizon((h) => h.loadAccount(receiver)).catch(() => null);
    const claimableBalance = Operation.createClaimableBalance({ amount: amount.toString(), claimants: [new Claimant(receiver)], asset });

    if (receiverAccount == null) {
      if (token === "native") {
        builder.addOperation(Operation.createAccount({ destination: receiver, startingBalance: Math.max(1, sendAmount).toString() }));
        needXlm = Math.max(1, sendAmount);
      } else {
        builder.addOperation(Operation.createAccount({ destination: receiver, startingBalance: "1" }));
        builder.addOperation(claimableBalance);
        needXlm = 1;
      }
    } else {
      const trustline = receiverAccount.balances.find((b: any) => {
        if (b.asset_type === "native") return false;
        return b.asset_code === asset.code && b.asset_issuer === asset.issuer;
      });

      // Check if trustline exists for non-native assets
      if (token !== "native" && !trustline) {
        builder.addOperation(claimableBalance);
      } else {
        builder.addOperation(Operation.payment({ destination: receiver, asset, amount: sendAmount.toString() }));
      }
    }

    const tx = builder.build();
    const fee = BigInt(Math.floor(baseFee * tx.operations.length));
    const need = fee + BigInt(formatter.parseAmount(needXlm, 7));

    return { fee: new ReviewFee({ baseFee: need, priorityFee: 0n, gasLimit: 1n, chain: Network.Stellar }), tx };
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }) {
    if (args.token.isOmni) return await super.transfer(args);
    const { tx } = await this.emulateTransfer(args.token.address, args.receiver, args.amount, args.comment);
    return this.sendTransaction(tx);
  }

  async sendTransaction(transaction: Transaction) {
    if (!this.wallet.signTransaction) throw "not impl";
    const result = await this.wallet.signTransaction(transaction);
    const txObject = new Transaction(result.signedTxXdr, Networks.PUBLIC);
    const { hash } = await this.wallet.rpc.callHorizon((t) => t.submitTransaction(txObject as any));
    return hash;
  }

  async signMessage(message: string) {
    if (!this.wallet.signMessage) throw "not impl";
    return await this.wallet.signMessage(message);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      nonce: base64.encode(nonce),
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      intents: intents,
    });

    const signature = await this.signMessage(message);

    return {
      signature: `ed25519:${base58.encode(base64.decode(signature.signedMessage))}`,
      public_key: `ed25519:${this.publicKey}`,
      standard: "sep53",
      payload: message,
    };
  }

  static async isTokenActivated(address: string, token: string) {
    if (address === "native") return true;
    const data = await fetch(`https://horizon.stellar.org/accounts/${address}`).then((res) => res.json());
    return data.balances.some((ft: any) => {
      if (!ft.asset_issuer) return false;
      const asset = new Asset(ft.asset_code, ft.asset_issuer).contractId(Networks.PUBLIC);
      return asset.toLowerCase() === token.toLowerCase();
    });
  }

  async changeTrustline(address: string) {
    if (address === "native") return;
    const asset = await this.getAssetFromContractId(address);
    const account = await this.wallet.rpc.callHorizon((h) => h.loadAccount(this.address));
    const trustlineOp = Operation.changeTrust({ asset: asset, source: this.address });
    const trustlineTx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC }) //
      .addOperation(trustlineOp)
      .setTimeout(TimeoutInfinite)
      .build();

    return this.sendTransaction(trustlineTx);
  }

  readonly assetsCache = new Map<string, Asset>();
  async getAssetFromContractId(id: string): Promise<Asset> {
    if (id === "native") return Asset.native();
    if (this.assetsCache.has(id)) {
      return Promise.resolve(this.assetsCache.get(id)!);
    }

    const tx = await this.buildSmartContactTx(ACCOUNT_FOR_SIMULATE, id, ASSET_CONTRACT_METHOD.NAME);
    const result = (await this.wallet.rpc.callSoroban((s) => s.simulateTransaction(tx as any))) as unknown as rpc.Api.SimulateTransactionSuccessResponse;

    const value = result?.result?.retval?.value();
    if (!value) throw "Asset not found";

    const [code, issuer] = value.toString().split(":");
    const asset = issuer ? new Asset(code, issuer) : Asset.native();
    this.assetsCache.set(id, asset);
    return asset;
  }

  async buildSmartContactTx(publicKey: string, contactId: string, method: string, ...args: any[]) {
    const account = await this.wallet.rpc.callSoroban((s) => s.getAccount(publicKey));
    const contract = new Contract(contactId);
    const builtTx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC });

    if (args) builtTx.addOperation(contract.call(method, ...args));
    else builtTx.addOperation(contract.call(method));
    return builtTx.setTimeout(TimeoutInfinite).build();
  }

  async getTokenBalance(token: Asset | string, contract: string): Promise<bigint> {
    const tx = await this.buildSmartContactTx(
      ACCOUNT_FOR_SIMULATE, //
      typeof token === "string" ? (token === "native" ? new Asset("XLM").contractId(Networks.PUBLIC) : token) : token.contractId(Networks.PUBLIC),
      ASSET_CONTRACT_METHOD.GET_BALANCE,
      Address.fromString(contract).toScVal()
    );

    const result = (await this.wallet.rpc.callSoroban((s) => s.simulateTransaction(tx as any))) as unknown as rpc.Api.SimulateTransactionSuccessResponse;
    if (result) return BigInt(this.i128ToInt(result.result?.retval.value() as xdr.Int128Parts));
    return 0n;
  }

  i128ToInt(val: xdr.Int128Parts): string {
    // @ts-expect-error TODO: fix this
    return new BigNumber(val.hi()._value).plus(val.lo()._value).div(1e7).toString();
  }
}

export default StellarWallet;
