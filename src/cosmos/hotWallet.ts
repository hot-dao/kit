import { base64 } from "@scure/base";
import HOT from "../hot-wallet/iframe";

export const HOT_COSMOS_ID = "hot-wallet";

export class HotCosmosModule {
  productId = HOT_COSMOS_ID;
  productName = "HOT Wallet";
  productUrl = "https://hot-labs.org/wallet";
  productIcon = "https://storage.herewallet.app/logo.png";

  async enable(chainIds: string[]) {
    await HOT.request("cosmos:enable", { chainIds });
  }

  async getKey(chainId: string) {
    return await HOT.request("cosmos:getKey", { chainId });
  }

  async signAmino(chainId: string, signer: string, signDoc: any) {
    return await HOT.request("cosmos:signAmino", { chainId, signer, signDoc });
  }

  async signArbitrary(chainId: string, signer: string, data: string) {
    return await HOT.request("cosmos:signArbitrary", { chainId, signer, data });
  }

  async signDirect(chainId: string, signer: string, signDoc: any) {
    return await HOT.request("cosmos:signDirect", { chainId, signer, signDoc });
  }

  async getOfflineSignerAuto(chainId: string) {
    const self = this;
    return {
      getAccounts: async () => {
        const key = await self.getKey(chainId);
        return [
          {
            address: key.bech32Address,
            algo: "secp256k1" as const,
            pubkey: base64.decode(key.pubKey),
          },
        ];
      },
      signAmino: (signerAddress: string, doc: any) => self.signAmino(chainId, signerAddress, doc),
      signDirect: async (signerAddress: string, doc: any) => {
        const serialized = {
          ...doc,
          bodyBytes: doc.bodyBytes ? base64.encode(doc.bodyBytes) : null,
          authInfoBytes: doc.authInfoBytes ? base64.encode(doc.authInfoBytes) : null,
        };
        const result = await self.signDirect(chainId, signerAddress, serialized);
        if (result.signed) {
          if (typeof result.signed.bodyBytes === "string") {
            result.signed.bodyBytes = base64.decode(result.signed.bodyBytes);
          }
          if (typeof result.signed.authInfoBytes === "string") {
            result.signed.authInfoBytes = base64.decode(result.signed.authInfoBytes);
          }
        }
        return result;
      },
    };
  }
}
