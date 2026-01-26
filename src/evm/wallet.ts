import { base64, base58, hex } from "@scure/base";
import { BrowserProvider, ethers, JsonRpcProvider, TransactionRequest } from "ethers";
import { JsonRpcSigner, FetchRequest } from "ethers";

import { OmniConnector } from "../core/OmniConnector";
import { OmniWallet } from "../core/OmniWallet";
import { Network, WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";
import { Commitment } from "../core";
import { api } from "../core/api";
import { erc20abi } from "./abi";

export interface EvmProvider {
  request: (args: any) => Promise<any>;
  on?: (method: string, handler: (args: any) => void) => void;
  off?: (method: string, handler: (args: any) => void) => void;
}

class EvmWallet extends OmniWallet {
  readonly publicKey?: string;
  readonly type = WalletType.EVM;
  readonly icon = "https://storage.herewallet.app/upload/06b43b164683c2cbfe9a9c0699f0953fd56f1f802035e7701ea10501d9e091c6.png";

  constructor(readonly connector: OmniConnector, readonly address: string, readonly provider: EvmProvider) {
    super();
  }

  get omniAddress() {
    return this.address.toLowerCase();
  }

  private rpcs: Record<number, JsonRpcProvider> = {};
  rpc(chain: number) {
    if (chain < 1 || chain == null) throw "Invalid chain";
    if (this.rpcs[chain]) return this.rpcs[chain];

    const request = new FetchRequest(api.getRpcUrl(chain));
    request.setHeader("Api-Key", api.apiKey);

    const rpc = new JsonRpcProvider(request, chain, { staticNetwork: true });
    this.rpcs[chain] = rpc;
    return rpc;
  }

  async disconnect() {
    await this.provider.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
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

  async fetchBalance(chain: number, address: string) {
    if (chain === Network.Omni) return super.fetchBalance(chain, address);

    const rpc = this.rpc(chain);
    if (address === "native") {
      const balance = await rpc.getBalance(this.address);
      return this.setBalance(`${chain}:${address}`, BigInt(balance));
    }

    const erc20 = new ethers.Contract(address, erc20abi, rpc);
    const balance = await erc20.balanceOf(this.address);
    return this.setBalance(`${chain}:${address}`, BigInt(balance));
  }

  async signMessage(msg: string) {
    if (!this.provider.request) throw "not impl";
    const result: string = await this.provider.request({ method: "personal_sign", params: [msg, this.address] });
    const yInt = parseInt(result.slice(-2), 16);
    const isZero = yInt === 27 || yInt === 0;
    return hex.decode(result.slice(2, -2) + (isZero ? "00" : "01"));
  }

  async transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee> {
    const rpc = this.rpc(token.chain);
    const fee = ReviewFee.fromFeeData(await rpc.getFeeData(), token.chain);

    if (token.address === "native") {
      const gasLimit = await rpc.estimateGas({ from: this.address, to: receiver, value: 100n, ...fee.evmGas });
      const extaLimit = BigInt(Math.floor(Number(gasLimit) * 1.3));
      return fee.changeGasLimit(extaLimit);
    }

    const erc20 = new ethers.Contract(token.address, erc20abi, rpc);
    const transferTx = await erc20.transfer.populateTransaction(receiver, amount, fee.evmGas);
    transferTx.from = this.address;

    const gasLimit = await rpc.estimateGas(transferTx);
    const extaLimit = BigInt(Math.floor(Number(gasLimit) * 1.3));
    return fee.changeGasLimit(extaLimit);
  }

  async sendTransaction(request: TransactionRequest): Promise<string> {
    if (!request.chainId) throw "Chain ID is required";

    if (!this.provider.request) throw "not impl";
    const provider = new BrowserProvider(this.provider as any);
    const signer = new JsonRpcSigner(provider, this.address);

    await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${request.chainId.toString(16)}` }] });
    const tx = await signer.sendTransaction(request);
    return tx.hash;
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (args.token.address === "native") {
      return await this.sendTransaction({
        ...args.gasFee?.evmGas,
        chainId: args.token.chain,
        from: this.address,
        value: args.amount,
        to: args.receiver,
      });
    }

    const erc20 = new ethers.Contract(args.token.address, erc20abi, this.rpc(args.token.chain));
    const tx = await erc20.transfer.populateTransaction(args.receiver, args.amount, { ...args.gasFee?.evmGas });
    tx.chainId = BigInt(args.token.chain);
    tx.from = this.address;

    return await this.sendTransaction(tx);
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

    const buffer = await this.signMessage(message);
    return {
      signature: `secp256k1:${base58.encode(buffer)}`,
      payload: message,
      standard: "erc191",
    };
  }
}

export default EvmWallet;
