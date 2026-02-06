import { Address } from "@ton/core";
import { hex, base32, base58 } from "@scure/base";

import { type OmniWallet } from "./OmniWallet";
import { tonApi } from "../ton/utils";
import { chains, Network, WalletType } from "./chains";
import { isValidAddress } from "./address";

export class Recipient {
  constructor(readonly type: WalletType, readonly address: string, readonly omniAddress: string) {}

  get chainName() {
    return chains.get(this.type)?.name || "Unknown";
  }

  fetchBalance(chain: number, address: string): Promise<bigint> {
    // TODO: implement
    throw new Error("Not implemented");
  }

  static fromWallet(wallet?: OmniWallet) {
    if (!wallet) return undefined;
    return new Recipient(wallet.type, wallet.address, wallet.omniAddress);
  }

  static isValidAddress(type: WalletType, address: string) {
    return isValidAddress(type, address);
  }

  static async fromAddress(chain: Network, address: string) {
    if (!isValidAddress(chain, address)) throw new Error("Invalid address");

    if (chain === Network.Ton) {
      const data = await tonApi.accounts.getAccountPublicKey(Address.parse(address));
      return new Recipient(WalletType.TON, address, data.publicKey.toLowerCase());
    }

    if (chains.get(chain)?.type === WalletType.EVM) {
      return new Recipient(WalletType.EVM, address, address.toLowerCase());
    }

    if (chains.get(chain)?.type === WalletType.NEAR) {
      return new Recipient(WalletType.NEAR, address, address.toLowerCase());
    }

    if (chains.get(chain)?.type === WalletType.STELLAR) {
      const payload = base32.decode(address);
      return new Recipient(WalletType.STELLAR, address, hex.encode(payload.slice(1, -2)).toLowerCase());
    }

    if (chains.get(chain)?.type === WalletType.SOLANA) {
      return new Recipient(WalletType.SOLANA, address, hex.encode(base58.decode(address)).toLowerCase());
    }

    return new Recipient(chains.get(chain)?.type || WalletType.unknown, address, "");
  }
}
