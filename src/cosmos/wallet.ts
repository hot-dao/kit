import { Signature, computeAddress, recoverAddress } from "ethers";
import { StdSignature } from "@keplr-wallet/types";
import { StargateClient } from "@cosmjs/stargate";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, base64, hex } from "@scure/base";

import { OmniWallet } from "../core/OmniWallet";
import { chains, WalletType } from "../core/chains";
import { Commitment } from "../core/types";
import { ReviewFee } from "../core/bridge";

import { makeADR36AminoSignDoc, serializeSignDoc } from "./adr36";

interface ProtocolWallet {
  disconnect?: () => Promise<void>;
  signMessage?: (chainId: string, address: string, message: string) => Promise<StdSignature>;
  signAmino: (chainId: string, address: string, signDoc: any) => Promise<{ signature: StdSignature }>;
  sendTransaction?: (signDoc: any) => Promise<string>;
  account: { address: string; publicKey: string };
  cosmos: { address: string; publicKey: string };
  disableOmni: boolean;
  chainId: string;
}

export default class CosmosWallet extends OmniWallet {
  readonly icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  readonly type = WalletType.COSMOS;

  constructor(readonly wallet: ProtocolWallet) {
    super();
  }

  get address() {
    return this.wallet.account.address;
  }

  get publicKey() {
    return this.wallet.account.publicKey;
  }

  get omniAddress() {
    if (this.wallet.disableOmni) return "";
    return computeAddress(`0x${this.wallet.cosmos.publicKey}`).toLowerCase();
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

  async findFullSignature(signature: Uint8Array, msgHash: Uint8Array) {
    const validate = (v: 0 | 1) => {
      const sign = Signature.from({ v: v, r: "0x" + hex.encode(signature.slice(0, 32)), s: "0x" + hex.encode(signature.slice(32)) });
      const recoveredAddr = recoverAddress(msgHash, sign.serialized);
      if (this.omniAddress === recoveredAddr.toLowerCase()) return new Uint8Array([...signature, v]);
      return null;
    };

    const sig27 = validate(0);
    if (sig27) return sig27;

    const sig28 = validate(1);
    if (sig28) return sig28;

    throw "Invalid signature";
  }

  async signMessage(message: string): Promise<StdSignature> {
    if (!this.wallet.signMessage) {
      const signDoc = makeADR36AminoSignDoc(this.wallet.cosmos.address, message);
      const { signature } = await this.wallet.signAmino("cosmoshub-4", this.wallet.cosmos.address, signDoc);
      return signature;
    }

    return await this.wallet.signMessage("cosmoshub-4", this.wallet.cosmos.address, message);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    if (this.wallet.disableOmni) throw "Sign intents is not supported for this wallet";

    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));
    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      nonce: base64.encode(nonce),
      intents: intents,
    });

    const signDoc = makeADR36AminoSignDoc(this.wallet.cosmos.address, message);
    const { signature } = await this.signMessage(message);

    const msgHash = sha256(serializeSignDoc(signDoc));
    const fullSignature = await this.findFullSignature(base64.decode(signature), msgHash);

    return {
      standard: "adr36",
      signature: `secp256k1:${base58.encode(fullSignature)}`,
      payload: { signer: this.wallet.cosmos.address, message },
    };
  }

  async fetchBalances(chain: number, whitelist: string[] = []): Promise<Record<string, bigint>> {
    const tasks = whitelist.map(async (token) => [token, await this.fetchBalance(chain, token)]);
    return Object.fromEntries(await Promise.all(tasks));
  }

  async fetchBalance(chain: number, token: string): Promise<bigint> {
    const config = chains.get(chain);
    if (!config || config.type !== WalletType.COSMOS) return super.fetchBalance(chain, token);

    const client = await StargateClient.connect(config.rpc);
    const balance = await client.getBalance(this.address, token);

    return this.setBalance(`${chain}:${token}`, BigInt(balance.amount || 0));
  }
}
