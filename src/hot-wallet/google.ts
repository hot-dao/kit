import { WalletManifest, SignAndSendTransactionParams, SignAndSendTransactionsParams, SignMessageParams } from "@hot-labs/near-connect";
import type { Transaction } from "@stellar/stellar-base";
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
import { HotKit } from "../HotKit";

export interface GoogleConnectorOptions {
  webWallet?: string;
}

class GoogleConnector extends OmniConnector<OmniWallet> {
  walletTypes = [WalletType.EVM, WalletType.STELLAR, WalletType.TON, WalletType.NEAR, WalletType.SOLANA];
  icon = "https://storage.herewallet.app/upload/0eb073753bd1ddabc3ceb5611ad80dd0cb5ca5a9c6ed066bf89ec4f1364c809d.svg";
  type = ConnectorType.SOCIAL;
  name = "Connect via Google";
  id = "google";
  webWallet: string;

  constructor(kit: HotKit, options?: GoogleConnectorOptions) {
    super(kit);

    this.webWallet = options?.webWallet ?? "https://app.hot-labs.org";
    makeObservable(this, { connectWallet: action });
    this.getStorage().then((accounts: any) => {
      if (!Array.isArray(accounts)) return;
      accounts.forEach((account: any) => this.connectWallet({ account, isNew: false }));
    });
  }

  openWallet() {
    const width = 480;
    const height = 640;
    const x = (window.screen.width - width) / 2;
    const y = (window.screen.height - height) / 2;
    return window.open(`${this.kit.settings.webWallet}`, "_blank", `popup=1,width=${width},height=${height},top=${y},left=${x}`);
  }

  connectWallet({ account, isNew }: { account: { type: number; address: string; publicKey: string }; isNew: boolean }) {
    const request = this.requestWebWallet(account.type, account.address);

    if (account.type === WalletType.EVM) {
      const wallet = new EvmWallet(this, account.address, { request: (args: any) => request("evm:request", args) });
      this.setWallet({ wallet, isNew });
    }

    if (account.type === WalletType.STELLAR) {
      const signMessage = async (message: string) => request("stellar:signMessage", { message });
      const signTransaction = async (transaction: Transaction) => request("stellar:signTransaction", { transaction: transaction.toXDR() });
      const wallet = new StellarWallet({
        rpc: this.kit.exchange.bridge.stellar,
        address: account.address,
        signTransaction,
        signMessage,
      });
      this.setWallet({ wallet, isNew });
    }

    if (account.type === WalletType.TON) {
      const wallet = new TonWallet({
        sendTransaction: (params) => request("ton:sendTransaction", params),
        signData: (params) => request("ton:signData", params),
        account: { address: account.address, publicKey: account.publicKey },
      });
      this.setWallet({ wallet, isNew });
    }

    if (account.type === WalletType.NEAR) {
      const wallet = new NearWallet(account.address, account.publicKey, {
        signAndSendTransaction: (params: SignAndSendTransactionParams) => request("near:signAndSendTransaction", params),
        signAndSendTransactions: (params: SignAndSendTransactionsParams) => request("near:signAndSendTransactions", params),
        signMessage: (params: SignMessageParams) => request("near:signMessage", params),
        getAccounts: async () => [{ accountId: account.address, publicKey: account.publicKey }],
        signIn: () => request("near:signIn", {}),
        manifest: {} as unknown as WalletManifest,
        signOut: async () => {},
      }) as NearWallet;
      this.setWallet({ wallet, isNew });
    }

    if (account.type === WalletType.SOLANA) {
      const wallet = new SolanaWallet({
        sendTransaction: async (transaction: unknown, _: unknown, options?: unknown) => await request("solana:sendTransaction", { transaction, options }),
        signMessage: async (message: string) => await request("solana:signMessage", { message }),
        disconnect: async () => {},
        address: account.address,
      });
      this.setWallet({ wallet, isNew });
    }
  }

  async connect() {
    const accounts = await this.requestWebWallet()("connect:google", {});
    accounts.forEach((account: { type: number; address: string; publicKey: string }) => this.connectWallet({ account, isNew: true }));
    this.setStorage(accounts);
    return this.wallets[0];
  }

  async silentDisconnect() {
    this.removeAllWallets();
    this.removeStorage();
  }

  requestWebWallet = (chain?: number, address?: string) => (method: string, request: any) => {
    const popup = this.openWallet();

    return new Promise<any>(async (resolve, reject) => {
      const interval = setInterval(() => {
        if (!popup?.closed) return;
        clearInterval(interval);
        reject(new Error("User rejected"));
      }, 100);

      const id = uuid4();
      const handler = (event: MessageEvent) => {
        if (event.origin !== this.kit.settings.webWallet) return;

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
