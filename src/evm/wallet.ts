import { base64, base58, hex } from "@scure/base";
import { BrowserProvider, ethers, JsonRpcProvider, TransactionRequest } from "ethers";
import { JsonRpcSigner, FetchRequest } from "ethers";

import { OmniConnector } from "../OmniConnector";
import { OmniWallet } from "../OmniWallet";
import { WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";
import { erc20abi } from "./abi";
import { Commitment } from "../core";
import { api } from "../core/api";

export interface EvmProvider {
  request: (args: any) => Promise<any>;
  on?: (method: string, handler: (args: any) => void) => void;
  off?: (method: string, handler: (args: any) => void) => void;
}

class EvmWallet extends OmniWallet {
  readonly publicKey?: string;
  readonly type = WalletType.EVM;

  constructor(readonly connector: OmniConnector, readonly address: string, readonly provider: EvmProvider) {
    super(connector);
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

  get omniAddress() {
    return this.address.toLowerCase();
  }

  async disconnect() {
    this.provider.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    await super.disconnect();
  }

  async fetchBalances(chain: number, whitelist: string[]): Promise<Record<string, bigint>> {
    const native = await this.fetchBalance(chain, "native");
    try {
      const res = await fetch(`https://api0.herewallet.app/api/v1/user/balances/${chain}/${this.address}`, { body: JSON.stringify({ whitelist, chain_id: chain }), method: "POST" });
      if (!res.ok) throw new Error("Failed to fetch balances");
      const { balances } = await res.json();
      return { ...balances, native };
    } catch {
      const balances = await Promise.all(
        whitelist.map(async (token) => {
          const balance = await this.fetchBalance(chain, token);
          return [token, balance];
        })
      );
      return { ...Object.fromEntries(balances), native };
    }
  }

  async fetchBalance(chain: number, address: string) {
    const rpc = this.rpc(chain);
    if (address === "native") {
      const balance = await rpc.getBalance(this.address);
      return BigInt(balance);
    }

    const erc20 = new ethers.Contract(address, erc20abi, rpc);
    const balance = await erc20.balanceOf(this.address);
    return BigInt(balance);
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
      const gasLimit = await rpc.estimateGas({ to: receiver, value: 100n, ...fee.evmGas });
      const extaLimit = BigInt(Math.floor(Number(gasLimit) * 1.3));
      return fee.changeGasLimit(extaLimit);
    }

    const erc20 = new ethers.Contract(token.address, erc20abi, rpc);
    const gasLimit = await erc20.transfer.estimateGas(receiver, amount, fee.evmGas);
    const extaLimit = BigInt(Math.floor(Number(gasLimit) * 1.3));
    return fee.changeGasLimit(extaLimit);
  }

  async sendTransaction(chain: number, request: TransactionRequest): Promise<string> {
    if (!this.provider.request) throw "not impl";
    const provider = new BrowserProvider(this.provider as any);
    const signer = new JsonRpcSigner(provider, this.address);

    await this.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chain.toString(16)}` }] });
    const tx = await signer.sendTransaction(request);
    return tx.hash;
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (args.token.address === "native") {
      return await this.sendTransaction(args.token.chain, {
        ...args.gasFee?.evmGas,
        from: this.address,
        value: args.amount,
        to: args.receiver,
      });
    }

    const erc20 = new ethers.Contract(args.token.address, erc20abi, this.rpc(args.token.chain));
    const tx = await erc20.transfer.populateTransaction(args.receiver, args.amount, { ...args.gasFee?.evmGas });
    return await this.sendTransaction(args.token.chain, tx);
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
