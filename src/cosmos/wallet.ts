import { StargateClient } from "@cosmjs/stargate";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

import { chainsMap, WalletType } from "../omni/config";
import { ReviewFee } from "../omni/fee";
import { Token } from "../omni/token";

import { OmniWallet, SignedAuth } from "../omni/OmniWallet";
import CosmosConnector from "./connector";

interface ProtocolWallet {
  disconnect: () => Promise<void>;
  sendTransaction: (signDoc: any) => Promise<string>;
  address: string;
  publicKey: string;
}

console.log({ OmniWallet });

export default class CosmosWallet extends OmniWallet {
  readonly type = WalletType.COSMOS;

  constructor(readonly connector: CosmosConnector, readonly wallet: ProtocolWallet) {
    super(connector);
  }

  get address() {
    return this.wallet.address;
  }

  get publicKey() {
    return this.wallet.publicKey;
  }

  get omniAddress() {
    return "";
  }

  async disconnect({ silent = false }: { silent?: boolean } = {}) {
    super.disconnect({ silent });
    this.wallet.disconnect();
  }

  sendTransaction(signDoc: any): Promise<string> {
    return this.wallet.sendTransaction(signDoc);
  }

  transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee> {
    throw new Error("Method not implemented.");
  }

  transfer(args: { chain: number; token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    return this.wallet.sendTransaction({
      bodyBytes: new Uint8Array(),
      authInfoBytes: new Uint8Array(),
      chainId: args.chain.toString(),
      accountNumber: 12345,
      sequence: 12345,
    });
  }

  signIntentsWithAuth(domain: string, intents?: Record<string, any>[]): Promise<SignedAuth> {
    throw new Error("Method not implemented.");
  }

  signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number }): Promise<Record<string, any>> {
    throw new Error("Method not implemented.");
  }

  async fetchBalance(chain: number, token: string): Promise<bigint> {
    const config = this.connector.getConfig(chainsMap[chain]);
    if (!config) throw new Error("Config not found");
    const client = await StargateClient.connect(config.rpc);

    const address = toBech32(config.prefix, fromBech32(this.address).data);
    const balance = await client.getBalance(address, token);

    console.log({ chain, balance, address, token });
    return BigInt(balance.amount || 0);
  }
}
