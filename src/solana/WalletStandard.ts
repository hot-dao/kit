import { base58 } from "@scure/base";
import type { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Wallet } from "@wallet-standard/base";

export interface ISolanaProtocolWallet {
  address: string;
  sendTransaction?: (transaction: Transaction | VersionedTransaction, connection: Connection, options?: any) => Promise<string>;
  signMessage?: (message: string) => Promise<Uint8Array>;
  disconnect?: (data?: { silent?: boolean }) => Promise<void>;
}

class SolanaProtocolWallet implements ISolanaProtocolWallet {
  readonly address: string;
  constructor(readonly wallet: Wallet, readonly publicKey: Uint8Array) {
    this.address = base58.encode(publicKey);
  }

  static async connect(wallet: Wallet, { silent = false }: { silent?: boolean } = {}): Promise<ISolanaProtocolWallet> {
    const a = new SolanaProtocolWallet(wallet, new Uint8Array(32));
    const account = await a.getAccount({ silent });
    return new SolanaProtocolWallet(wallet, new Uint8Array(account.publicKey));
  }

  async getAccount({ silent = false }: { silent?: boolean } = {}) {
    let accounts = this.wallet.accounts || [];

    if (!accounts.length) {
      const connect = (this.wallet.features as any)["standard:connect"]?.connect;
      if (!connect) throw new Error("Wallet does not support standard:connect");
      const { accounts: connectedAccounts } = await connect({ silent });
      accounts = connectedAccounts || [];
    }

    if (!accounts.length) throw new Error("No account found");
    if (!accounts[0].publicKey) throw new Error("No account found");
    return accounts[0];
  }

  async disconnect() {
    const disconnect = (this.wallet.features as any)["standard:disconnect"]?.disconnect as (() => Promise<void>) | undefined;
    if (disconnect) await disconnect();
  }

  async sendTransaction(transaction: Transaction | VersionedTransaction, connection: Connection, options?: any): Promise<string> {
    const account = await this.getAccount();
    const features = this.wallet.features as any;
    const signTx = features["solana:signTransaction"]?.signTransaction;
    const [signed] = await signTx({ account, chain: account.chains[0], transaction: transaction.serialize() });
    const signedTx = signed.signedTransaction as Transaction | VersionedTransaction | Uint8Array;
    const raw = signedTx instanceof Uint8Array ? signedTx : (signedTx as any).serialize();
    const sig = await connection.sendRawTransaction(raw as Uint8Array, options as any);
    return sig;
  }

  async signMessage(message: string) {
    const account = await this.getAccount();
    const features = this.wallet.features as any;
    const signMessageFeature = features["solana:signMessage"]?.signMessage;

    if (!signMessageFeature) throw new Error("Wallet does not support solana:signMessage");
    const [result] = await signMessageFeature({ account, message: new TextEncoder().encode(message) });

    if (result.signature) return result.signature;
    if (Array.isArray(result) && result[0]?.signature) return result[0].signature as Uint8Array;
    throw new Error("Unexpected signMessage result");
  }
}

export default SolanaProtocolWallet;
