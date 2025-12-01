import type { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SolanaSignAndSendTransactionMethod, SolanaSignMessageMethod, SolanaSignTransactionMethod } from "@solana/wallet-standard-features";
import type { Wallet } from "@wallet-standard/base";
import { base58 } from "@scure/base";

export interface ISolanaProtocolWallet {
  address: string;
  sendTransaction?: (transaction: Transaction | VersionedTransaction, connection: Connection, options?: any) => Promise<string>;
  signMessage?: (message: string) => Promise<Uint8Array>;
  disconnect?: (data?: { silent?: boolean }) => Promise<void>;
}

class SolanaProtocolWallet implements ISolanaProtocolWallet {
  constructor(readonly wallet: Wallet, readonly address: string) {}

  static async connect(wallet: Wallet, { silent = false }: { silent?: boolean } = {}): Promise<ISolanaProtocolWallet> {
    const a = new SolanaProtocolWallet(wallet, "");
    const account = await a.getAccount({ silent });
    return new SolanaProtocolWallet(wallet, account.address);
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
    return accounts[0];
  }

  async disconnect() {
    const disconnect = (this.wallet.features as any)["standard:disconnect"]?.disconnect as (() => Promise<void>) | undefined;
    if (disconnect) await disconnect();
  }

  async sendTransaction(transaction: Transaction | VersionedTransaction, connection: Connection, options?: any): Promise<string> {
    const account = await this.getAccount();
    const features = this.wallet.features as any;

    const signAndSend = features["solana:signAndSendTransaction"]?.signAndSendTransaction as SolanaSignAndSendTransactionMethod;

    if (signAndSend) {
      const [result] = await signAndSend({ account, chain: account.chains[0], transaction: transaction.serialize() });
      const signature = typeof result === "string" ? result : result?.signature ?? result;
      return typeof signature === "string" ? signature : base58.encode(signature as Uint8Array);
    }

    const signTx = features["solana:signTransaction"]?.signTransaction as SolanaSignTransactionMethod;

    if (signTx) {
      const [signed] = await signTx({ account, chain: account.chains[0], transaction: transaction.serialize() });
      const signedTx = signed.signedTransaction as Transaction | VersionedTransaction | Uint8Array;
      const raw = signedTx instanceof Uint8Array ? signedTx : (signedTx as any).serialize();
      const sig = await connection.sendRawTransaction(raw as Uint8Array, options as any);
      return sig;
    }

    throw new Error("Wallet does not support Solana transaction signing");
  }

  async signMessage(message: string) {
    const account = await this.getAccount();
    const features = this.wallet.features as any;
    const signMessageFeature = features["solana:signMessage"]?.signMessage as SolanaSignMessageMethod;

    if (!signMessageFeature) throw new Error("Wallet does not support solana:signMessage");
    const [result] = await signMessageFeature({ account, message: new TextEncoder().encode(message) });

    if (result.signature) return result.signature;
    if (Array.isArray(result) && result[0]?.signature) return result[0].signature as Uint8Array;
    throw new Error("Unexpected signMessage result");
  }
}

export default SolanaProtocolWallet;
