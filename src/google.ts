import { SignAndSendTransactionParams, SignAndSendTransactionsParams, SignMessageParams } from "@hot-labs/near-connect";
import { Transaction } from "@stellar/stellar-base";
import { action, makeObservable } from "mobx";

import { requestWebWallet } from "./hot-wallet/wallet";
import { OmniWallet, WalletType } from "./omni/OmniWallet";
import { ConnectorType, OmniConnector } from "./omni/OmniConnector";
import EvmWallet from "./evm/wallet";
import NearWallet from "./near/wallet";
import SolanaWallet from "./solana/wallet";
import TonWallet from "./ton/wallet";
import StellarWallet from "./stellar/wallet";

class GoogleConnector extends OmniConnector<OmniWallet> {
  walletTypes = [WalletType.EVM, WalletType.STELLAR, WalletType.TON, WalletType.NEAR, WalletType.SOLANA];
  icon = "https://storage.herewallet.app/upload/0eb073753bd1ddabc3ceb5611ad80dd0cb5ca5a9c6ed066bf89ec4f1364c809d.svg";
  type = ConnectorType.SOCIAL;
  name = "Google Wallet";
  id = "google";

  constructor() {
    super();

    makeObservable(this, {
      connectWallet: action,
    });

    this.getStorage().then((accounts: any) => {
      accounts.forEach((account: any) => this.connectWallet(account));
    });
  }

  connectWallet(account: { type: number; address: string; publicKey: string }) {
    const request = requestWebWallet(account.type, account.address);

    if (account.type === WalletType.EVM) {
      this.setWallet(
        new EvmWallet(this, {
          address: account.address,
          request: (args) => request("evm:request", args),
        })
      );
    }

    if (account.type === WalletType.STELLAR) {
      const signMessage = async (message: string) => request("stellar:signMessage", { message });
      const signTransaction = async (transaction: Transaction) => request("stellar:signTransaction", { transaction: transaction.toXDR() });
      this.wallets.push(new StellarWallet(this, { address: account.address, signMessage, signTransaction }));
    }

    if (account.type === WalletType.TON) {
      this.setWallet(
        new TonWallet(this, {
          sendTransaction: (params) => request("ton:sendTransaction", params),
          signData: (params) => request("ton:signData", params),
          account: { address: account.address, publicKey: account.publicKey },
        })
      );
    }

    if (account.type === WalletType.NEAR) {
      this.setWallet(
        new NearWallet(this, account.address, account.publicKey, {
          signAndSendTransaction: (params: SignAndSendTransactionParams) => request("near:signAndSendTransaction", params),
          signAndSendTransactions: (params: SignAndSendTransactionsParams) => request("near:signAndSendTransactions", params),
          signMessage: (params: SignMessageParams) => request("near:signMessage", params),
          getAccounts: async () => [{ accountId: account.address, publicKey: account.publicKey }],
          signIn: () => request("near:signIn", {}),
          signOut: async () => {},
          manifest: {} as any,
        }) as NearWallet
      );
    }

    if (account.type === WalletType.SOLANA) {
      this.setWallet(
        new SolanaWallet(this, {
          sendTransaction: async (transaction: any, _: any, options?: any) => await request("solana:sendTransaction", { transaction, options }),
          signMessage: async (message: string) => await request("solana:signMessage", { message }),
          disconnect: async () => {},
          address: account.address,
        })
      );
    }
  }

  async connect() {
    const accounts = await requestWebWallet()("connect:google", {});
    accounts.forEach((account: { type: number; address: string; publicKey: string }) => this.connectWallet(account));
    this.setStorage(accounts);
  }

  async silentDisconnect() {
    this.removeAllWallets();
    this.removeStorage();
  }
}

export default GoogleConnector;
