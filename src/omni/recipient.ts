import { Address } from "@ton/core";
import { hex, base32, base58 } from "@scure/base";
import { tonApi } from "../ton/utils";
import { WalletType } from "./config";
import { OmniWallet } from "./OmniWallet";

export class Recipient {
  constructor(readonly type: WalletType, readonly address: string, readonly omniAddress: string) {}

  static fromWallet(wallet?: OmniWallet) {
    if (!wallet) return undefined;
    return new Recipient(wallet.type, wallet.address, wallet.omniAddress);
  }

  static async fromAddress(type: WalletType, address: string) {
    if (type === WalletType.TON) {
      const data = await tonApi.accounts.getAccountPublicKey(Address.parse(address));
      return new Recipient(WalletType.TON, address, data.publicKey.toLowerCase());
    }

    if (type === WalletType.EVM) {
      return new Recipient(WalletType.EVM, address, address.toLowerCase());
    }

    if (type === WalletType.NEAR) {
      return new Recipient(WalletType.NEAR, address, address.toLowerCase());
    }

    if (type === WalletType.STELLAR) {
      const payload = base32.decode(address);
      return new Recipient(WalletType.STELLAR, address, hex.encode(payload.slice(1, -2)).toLowerCase());
    }

    if (type === WalletType.SOLANA) {
      return new Recipient(WalletType.OMNI, address, hex.encode(base58.decode(address)).toLowerCase());
    }

    throw "Unsupported wallet type";
  }
}
