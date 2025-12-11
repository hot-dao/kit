import { StargateClient } from "@cosmjs/stargate";
import { OmniWallet } from "../OmniWallet";
import { chains, WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import CosmosConnector from "./connector";
import { Commitment } from "../core";

interface ProtocolWallet {
  disconnect?: () => Promise<void>;
  sendTransaction?: (signDoc: any) => Promise<string>;
  address: string;
  publicKeyHex: string;
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
    return this.wallet.publicKeyHex;
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

  signIntents(): Promise<Commitment> {
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
    const config = chains.get(chain);
    if (!config) throw new Error("Config not found");
    const client = await StargateClient.connect(config.rpc);
    const balance = await client.getBalance(this.address, token);
    return BigInt(balance.amount || 0);
  }
}
