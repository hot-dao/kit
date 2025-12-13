import { Networks } from "@stellar/stellar-sdk";
import HOT from "../hot-wallet/iframe";

export const HOTWALLET_ID: string = "hot-wallet";

export class HotWalletModule {
  productId: string = HOTWALLET_ID;
  productName: string = "HOT Wallet";
  productUrl: string = "https://hot-labs.org/wallet";
  productIcon: string = "https://storage.herewallet.app/logo.png";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getAddress(): Promise<{ address: string }> {
    return await HOT.request("stellar:getAddress", {});
  }

  async signTransaction(xdr: string, opts?: { address?: string }): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    return await HOT.request("stellar:signTransaction", { xdr, accountToSign: opts?.address });
  }

  async signAuthEntry(authEntry: string, opts?: { address?: string }): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
    return await HOT.request("stellar:signAuthEntry", { authEntry, accountToSign: opts?.address });
  }

  async signMessage(message: string, opts?: { address?: string }): Promise<{ signedMessage: string; signerAddress?: string }> {
    return await HOT.request("stellar:signMessage", { message, accountToSign: opts?.address });
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return { network: "mainnet", networkPassphrase: Networks.PUBLIC };
  }
}
