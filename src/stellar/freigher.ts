import { isConnected, requestAccess, getAddress, signTransaction, signAuthEntry, signMessage, getNetwork } from "@stellar/freighter-api";

declare global {
  interface Window {
    stellar?: {
      provider: string;
      platform: string;
    };
  }
}

function parseError(e: any) {
  return {
    code: e?.error?.code || e?.code || -1,
    message: e?.error?.message || e?.message || (typeof e === "string" && e) || "Unhandled error from the wallet",
    ext: e?.error?.ext || e?.ext,
  };
}

const FREIGHTER_ID = "freighter";
export class FreighterModule {
  productId = FREIGHTER_ID;
  productName = "Freighter";
  productUrl = "https://freighter.app";
  productIcon = "https://stellar.creit.tech/wallet-icons/freighter.png";

  async runChecks() {
    if (!(await this.isAvailable())) {
      throw new Error("Freighter is not connected");
    }
  }

  async isAvailable() {
    if (window.stellar?.provider === "freighter" && window.stellar?.platform === "mobile") return false;
    return isConnected()
      .then(({ isConnected: isConnected2, error }) => !error && isConnected2)
      .catch(() => false);
  }

  async getAddress(params?: { skipRequestAccess?: boolean }): Promise<{ address: string }> {
    return this.runChecks()
      .then(async () => {
        if (params?.skipRequestAccess) return true;
        return requestAccess();
      })
      .then(() => getAddress())
      .then(({ address, error }) => {
        if (error) throw error;
        if (!address)
          throw {
            code: -3,
            message: "Getting the address is not allowed, please request access first.",
          };
        return { address };
      })
      .catch((e) => {
        throw parseError(e);
      });
  }
  async signTransaction(xdr: string, opts?: { address?: string; networkPassphrase?: string }): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    return this.runChecks()
      .then(async () => {
        const { signedTxXdr, signerAddress, error } = await signTransaction(xdr, {
          address: opts?.address,
          networkPassphrase: opts?.networkPassphrase,
        });
        if (error) throw error;
        return { signedTxXdr, signerAddress };
      })
      .catch((e) => {
        throw parseError(e);
      });
  }

  async signAuthEntry(authEntry: string, opts?: { address?: string; networkPassphrase?: string }): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
    return this.runChecks()
      .then(async () => {
        const { signedAuthEntry, signerAddress, error } = await signAuthEntry(authEntry, {
          address: opts?.address,
          networkPassphrase: opts?.networkPassphrase,
        });
        if (error || !signedAuthEntry) throw error;
        return { signedAuthEntry: Buffer.from(signedAuthEntry).toString("base64"), signerAddress };
      })
      .catch((e) => {
        throw parseError(e);
      });
  }

  async signMessage(message: string, opts?: { address?: string; networkPassphrase?: string }): Promise<{ signedMessage: string; signerAddress?: string }> {
    return this.runChecks()
      .then(async () => {
        const { signedMessage, signerAddress, error } = await signMessage(message, {
          address: opts?.address,
          networkPassphrase: opts?.networkPassphrase,
        });
        if (error || !signedMessage) throw error;
        return {
          signedMessage: typeof signedMessage === "string" ? signedMessage : Buffer.from(signedMessage).toString("base64"),
          signerAddress,
        };
      })
      .catch((e) => {
        throw parseError(e);
      });
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return this.runChecks()
      .then(async () => {
        const { network, networkPassphrase, error } = await getNetwork();
        if (error) throw error;
        return { network, networkPassphrase };
      })
      .catch((e) => {
        throw parseError(e);
      });
  }
}
