import { StargateClient } from "@cosmjs/stargate";
import { fromBech32, toBech32 } from "@cosmjs/encoding";

import { OmniWallet, SignedAuth } from "../omni/OmniWallet";
import { chainsMap, WalletType } from "../omni/config";
import { ReviewFee } from "../omni/fee";

import CosmosConnector from "./connector";

interface ProtocolWallet {
  disconnect?: () => Promise<void>;
  sendTransaction?: (signDoc: any) => Promise<string>;
  address: string;
  publicKey?: string;
}

export default class CosmosWallet extends OmniWallet {
  readonly type = WalletType.COSMOS;

  constructor(readonly connector: CosmosConnector, readonly wallet: ProtocolWallet) {
    super(connector);
  }

  get address() {
    return this.wallet.address;
  }

  get publicKey() {
    return this.wallet.publicKey || "";
  }

  get omniAddress() {
    return "";
  }

  async disconnect() {
    super.disconnect();
    this.wallet.disconnect?.();
  }

  sendTransaction(signDoc: any): Promise<string> {
    if (!this.wallet.sendTransaction) throw "Not impl";
    return this.wallet.sendTransaction(signDoc);
  }

  transferFee(): Promise<ReviewFee> {
    throw new Error("Method not implemented.");
  }

  transfer(): Promise<string> {
    throw "Not impl";
  }

  signIntentsWithAuth(): Promise<SignedAuth> {
    throw new Error("Method not implemented.");
  }

  signIntents(): Promise<Record<string, any>> {
    throw new Error("Method not implemented.");
  }

  async fetchBalances(chain: number, whitelist: string[]): Promise<Record<string, bigint>> {
    const balances = await Promise.all(
      whitelist.map(async (token) => {
        const balance = await this.fetchBalance(chain, token);
        return [token, balance];
      })
    );
    return Object.fromEntries(balances);
  }

  async fetchBalance(chain: number, token: string): Promise<bigint> {
    const config = this.connector.getConfig(chainsMap[chain].id);
    if (!config) throw new Error("Config not found");
    const client = await StargateClient.connect(config.rpc);

    const address = toBech32(config.prefix, fromBech32(this.address).data);
    const balance = await client.getBalance(address, token);
    return BigInt(balance.amount || 0);
  }
}
