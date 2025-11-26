import { base64, base58, hex } from "@scure/base";
import { BrowserProvider, ethers, JsonRpcSigner, TransactionRequest } from "ethers";

import { OmniConnector } from "../omni/OmniConnector";
import { OmniWallet } from "../omni/OmniWallet";
import { WalletType } from "../omni/config";
import { ReviewFee } from "../omni/fee";
import { Token } from "../omni/token";
import Provider from "./Provider";
import { erc20abi } from "./abi";

interface EvmProvider {
  address: string;
  request: (args: any) => Promise<any>;
}

class EvmWallet extends OmniWallet {
  readonly publicKey?: string;
  readonly type = WalletType.EVM;

  constructor(readonly connector: OmniConnector, readonly provider: EvmProvider) {
    super(connector);
  }

  private rpcs: Record<number, Provider> = {};
  rpc(chain: number) {
    if (this.rpcs[chain]) return this.rpcs[chain];
    const rpc = new Provider(chain);
    this.rpcs[chain] = rpc;
    return rpc;
  }

  get address() {
    return this.provider.address;
  }

  get omniAddress() {
    return this.address.toLowerCase();
  }

  async disconnect({ silent = false }: { silent?: boolean } = {}) {
    super.disconnect({ silent });
    this.provider.request({ method: "wallet_revokePermissions" });
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

  async signIntentsWithAuth(domain: string, intents?: Record<string, any>[]) {
    const seed = hex.encode(window.crypto.getRandomValues(new Uint8Array(32)));
    const msgBuffer = new TextEncoder().encode(`${domain}_${seed}`);
    const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));

    return {
      signed: await this.signIntents(intents || [], { nonce: new Uint8Array(nonce) }),
      chainId: WalletType.EVM,
      publicKey: this.address,
      address: this.address,
      seed,
    };
  }

  async signMessage(msg: string) {
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
    const provider = new BrowserProvider(this.provider);
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
    const tx = await erc20.transfer.populateTransaction(args.receiver, args.amount, args.gasFee?.evmGas);
    return await this.sendTransaction(args.token.chain, tx);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Record<string, any>> {
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
