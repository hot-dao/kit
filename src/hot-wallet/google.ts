import { WalletManifest, SignAndSendTransactionParams, SignAndSendTransactionsParams, SignMessageParams } from "@hot-labs/near-connect";
import { Transaction } from "@stellar/stellar-base";
import { action, makeObservable } from "mobx";
import uuid4 from "uuid4";

import { ConnectorType, OmniConnector } from "../core/OmniConnector";
import { OmniWallet } from "../core/OmniWallet";
import { WalletType } from "../core/chains";

import EvmWallet from "../evm/wallet";
import TonWallet from "../ton/wallet";
import NearWallet from "../near/wallet";
import SolanaWallet from "../solana/wallet";
import StellarWallet from "../stellar/wallet";
import { HotConnector } from "../HotConnector";

export interface GoogleConnectorOptions {
  webWallet?: string;
}

class GoogleConnector extends OmniConnector<OmniWallet> {
  walletTypes = [WalletType.EVM, WalletType.STELLAR, WalletType.TON, WalletType.NEAR, WalletType.SOLANA];
  icon = "https://storage.herewallet.app/upload/0eb073753bd1ddabc3ceb5611ad80dd0cb5ca5a9c6ed066bf89ec4f1364c809d.svg";
  type = ConnectorType.SOCIAL;
  name = "Google Wallet";
  id = "google";
  webWallet: string;

  constructor(wibe3: HotConnector, options?: GoogleConnectorOptions) {
    super(wibe3);

    this.webWallet = options?.webWallet ?? "https://wallet.google.com";
    makeObservable(this, { connectWallet: action });
    this.getStorage().then((accounts: any) => {
      accounts.forEach((account: any) => this.connectWallet(account));
    });
  }

  connectWallet(account: { type: number; address: string; publicKey: string }) {
    const request = this.requestWebWallet(account.type, account.address);

    if (account.type === WalletType.EVM) {
      this.setWallet(
        new EvmWallet(this, account.address, {
          request: (args: any) => request("evm:request", args),
        })
      );
    }

    if (account.type === WalletType.STELLAR) {
      const signMessage = async (message: string) => request("stellar:signMessage", { message });
      const signTransaction = async (transaction: Transaction) => request("stellar:signTransaction", { transaction: transaction.toXDR() });
      this.wallets.push(
        new StellarWallet({
          rpc: this.wibe3.exchange.bridge.stellar,
          address: account.address,
          signTransaction,
          signMessage,
        })
      );
    }

    if (account.type === WalletType.TON) {
      this.setWallet(
        new TonWallet({
          sendTransaction: (params) => request("ton:sendTransaction", params),
          signData: (params) => request("ton:signData", params),
          account: { address: account.address, publicKey: account.publicKey },
        })
      );
    }

    if (account.type === WalletType.NEAR) {
      this.setWallet(
        new NearWallet(account.address, account.publicKey, {
          signAndSendTransaction: (params: SignAndSendTransactionParams) => request("near:signAndSendTransaction", params),
          signAndSendTransactions: (params: SignAndSendTransactionsParams) => request("near:signAndSendTransactions", params),
          signMessage: (params: SignMessageParams) => request("near:signMessage", params),
          getAccounts: async () => [{ accountId: account.address, publicKey: account.publicKey }],
          signIn: () => request("near:signIn", {}),
          manifest: {} as unknown as WalletManifest,
          signOut: async () => {},
        }) as NearWallet
      );
    }

    if (account.type === WalletType.SOLANA) {
      this.setWallet(
        new SolanaWallet({
          sendTransaction: async (transaction: unknown, _: unknown, options?: unknown) => await request("solana:sendTransaction", { transaction, options }),
          signMessage: async (message: string) => await request("solana:signMessage", { message }),
          disconnect: async () => {},
          address: account.address,
        })
      );
    }
  }

  async connect() {
    const accounts = await this.requestWebWallet()("connect:google", {});
    accounts.forEach((account: { type: number; address: string; publicKey: string }) => this.connectWallet(account));
    this.setStorage(accounts);
    return this.wallets[0];
  }

  async silentDisconnect() {
    this.removeAllWallets();
    this.removeStorage();
  }

  requestWebWallet = (chain?: number, address?: string) => (method: string, request: any) => {
    const width = 480;
    const height = 640;
    const x = (window.screen.width - width) / 2;
    const y = (window.screen.height - height) / 2;
    const popup = window.open(`${this.wibe3.settings.webWallet}`, "_blank", `popup=1,width=${width},height=${height},top=${y},left=${x}`);

    return new Promise<any>(async (resolve, reject) => {
      const interval = setInterval(() => {
        if (!popup?.closed) return;
        clearInterval(interval);
        reject(new Error("User rejected"));
      }, 100);

      const id = uuid4();
      const handler = (event: MessageEvent) => {
        if (event.origin !== this.wibe3.settings.webWallet) return;

        if (event.data === "hot:ready") {
          popup?.postMessage({ chain, address, method, request, id }, "*");
          return;
        }

        if (event.data.id !== id) return;
        if (event.data.success === false) {
          clearInterval(interval);
          reject(new Error(event.data.payload));
          window.removeEventListener("message", handler);
        }

        window.removeEventListener("message", handler);
        resolve(event.data.payload);
        clearInterval(interval);
        popup?.close();
      };

      window.addEventListener("message", handler);
    });
  };
}

export default GoogleConnector;
