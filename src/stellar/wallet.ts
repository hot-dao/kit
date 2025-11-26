import { base64, base58, hex, base32 } from "@scure/base";
import { Asset, Networks, Transaction } from "@stellar/stellar-base";

import { OmniWallet, WalletType } from "../omni/OmniWallet";
import { OmniConnector } from "../omni/OmniConnector";
import { formatter, Token } from "../omni/token";
import { ReviewFee } from "../omni/fee";
import { Network } from "../omni/chains";
import { bridge } from "../omni";

interface ProtocolWallet {
  signTransaction: (transaction: Transaction) => Promise<{ signedTxXdr: string }>;
  signMessage: (message: string) => Promise<{ signedMessage: string }>;
  address: string;
}

class StellarWallet extends OmniWallet {
  readonly type = WalletType.STELLAR;

  constructor(readonly connector: OmniConnector, readonly wallet: ProtocolWallet) {
    super(connector);
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

  async fetchBalance(chain: number, token: string): Promise<bigint> {
    if (chain !== Network.Stellar) throw "Invalid chain";

    const data = await fetch(`https://horizon.stellar.org/accounts/${this.address}`).then((res) => res.json());
    const asset = (data.balances as any[])?.find((ft: any) => {
      const asset = ft.asset_type === "native" ? Asset.native() : new Asset(ft.asset_code, ft.asset_issuer);
      const contractId = ft.asset_type === "native" ? "native" : asset.contractId(Networks.PUBLIC);
      return token === contractId;
    });

    if (!asset) return 0n;

    if (token === "native") {
      const activatingReserve = asset.sponsor != null ? 0 : 1;
      const trustlines = data.balances.filter((t: any) => t.asset_type !== "native" && t.sponsor == null);
      const balance = BigInt(formatter.parseAmount(asset.balance, 7));
      const reserved = BigInt(formatter.parseAmount(activatingReserve + 0.5 * (trustlines.length + (data.num_sponsoring || 0)), 7));
      return formatter.bigIntMax(0n, balance - BigInt(reserved));
    }

    return BigInt(formatter.parseAmount(asset.balance, 7));
  }

  async transferFee(token: Token, receiver: string): Promise<ReviewFee> {
    return new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: token.chain });
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    throw new Error("Not implemented");
  }

  async signIntentsWithAuth(domain: string, intents?: Record<string, any>[]) {
    const seed = hex.encode(window.crypto.getRandomValues(new Uint8Array(32)));
    const msgBuffer = new TextEncoder().encode(`${domain}_${seed}`);
    const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));

    return {
      signed: await this.signIntents(intents || [], { nonce: new Uint8Array(nonce) }),
      publicKey: `ed25519:${this.publicKey}`,
      chainId: WalletType.STELLAR,
      address: this.address,
      seed,
    };
  }

  async sendTransaction(transaction: Transaction) {
    const result = await this.wallet.signTransaction(transaction);
    const txObject = new Transaction(result.signedTxXdr, Networks.PUBLIC);
    const { hash } = await bridge.stellar.callHorizon((t) => t.submitTransaction(txObject as any));
    return hash;
  }

  async signMessage(message: string) {
    return await this.wallet.signMessage(message);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Record<string, any>> {
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
}

export default StellarWallet;
