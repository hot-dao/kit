import { Address } from "@ton/core";
import { Address as StellarAddress } from "@stellar/stellar-sdk";
import { base32, base58, bech32, hex } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import * as ethers from "ethers";

import { chains, Network, WalletType } from "./chains";

export const isBase58 = (address: string) => {
  try {
    base58.decode(address);
    return true;
  } catch (e) {
    return false;
  }
};

export const isBase32 = (address: string) => {
  try {
    base32.decode(address);
    return true;
  } catch (e) {
    return false;
  }
};

export const isHex = (address: string) => {
  try {
    hex.decode(address);
    return true;
  } catch (e) {
    return false;
  }
};

export const isValidBtcAddress = (address: string) => {
  // Basic validation for Bitcoin addresses (P2PKH, P2SH, Bech32)
  const p2pkhRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const p2shRegex = /^[2mn][a-km-zA-HJ-NP-Z1-9]{25,39}$/;
  const bech32Regex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/;

  return p2pkhRegex.test(address) || p2shRegex.test(address) || bech32Regex.test(address);
};

export const MinAccountIdLen = 2;
export const MaxAccountIdLen = 64;
export const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export const NEAR_DOMAINS = [".near", ".sweat", ".usn", ".tg"];
export const NEAR_ADDRESS_HEX_LENGTH = 64;

export function isValidNearAccountId(accountId: string) {
  return !!accountId && accountId.length >= MinAccountIdLen && accountId.length <= MaxAccountIdLen && accountId.match(ValidAccountRe) != null;
}

export const isValidNearAddress = (address: string, { allowWithoutDomain, allowSubdomain } = { allowWithoutDomain: false, allowSubdomain: true }) => {
  if (!isValidNearAccountId(address)) return false;

  if (address.length === NEAR_ADDRESS_HEX_LENGTH) return true;
  if (allowWithoutDomain && !address.includes(".")) return true;

  const endsWithValidDomain = NEAR_DOMAINS.some((t) => address.endsWith(t));
  if (!endsWithValidDomain) return false;

  const parts = address.split(".");

  const lastPart = `.${parts[parts.length - 1]}`;
  if (!NEAR_DOMAINS.includes(lastPart)) return false;

  const otherParts = parts.slice(0, -1);
  const hasOtherDomains = otherParts.some((part) => NEAR_DOMAINS.includes(`.${part}`));
  if (hasOtherDomains) return false;

  if (allowSubdomain) return true;
  return parts.length <= 2;
};

export const isValidTronAddress = (base58Sting: string) => {
  if (base58Sting.length <= 4) return false;
  let address: Uint8Array;

  try {
    address = base58.decode(base58Sting);
  } catch (e) {
    return false;
  }

  if (base58Sting.length <= 4) return false;

  const len = address.length;
  const offset = len - 4;
  const checkSum = address.slice(offset);
  address = address.slice(0, offset);
  const hash0 = sha256(address);
  const hash1 = sha256(new Uint8Array(hash0));
  const checkSum1 = hash1.slice(0, 4);

  if (checkSum[0] === checkSum1[0] && checkSum[1] === checkSum1[1] && checkSum[2] === checkSum1[2] && checkSum[3] === checkSum1[3]) {
    return true;
  }

  return false;
};

export const isValidSolanaAddress = (address: string) => {
  if (address.startsWith("0x")) return false;
  if (ethers.isAddress(address) as boolean) return false;
  if (isBase58(address) && [32, 44].includes(address.length)) return true;
  return !!isValidNearAccountId(address) && address.endsWith(".sol");
};

export const EVM_DOMAINS = [".eth", ".cb.id"];
export const isValidEvmAddress = (address: string) => {
  return EVM_DOMAINS.some((t) => address.endsWith(t)) || ethers.isAddress(address);
};

export const isValidStellarAddress = (address: string) => {
  try {
    new StellarAddress(address);
    return true;
  } catch (e) {
    return false;
  }
};

export const isValidTonAddress = (address: string) => {
  try {
    Address.parse(address);
    return true;
  } catch (e) {
    return false;
  }
};

export const isValidCosmosAddress = (prefix: string, address: string) => {
  console.log(prefix, address);
  return address.startsWith(`${prefix}1`) && isBech32Address(address);
};

export const isBech32Address = (address: string) => {
  try {
    bech32.decode(address as `${string}1${string}`);
    return true;
  } catch (e) {
    return false;
  }
};

export const isValidAddress = (chain: number, address: string) => {
  if (chains.get(chain)?.type === WalletType.COSMOS) return isValidCosmosAddress(chains.get(chain)?.prefix || "", address);
  if (chains.get(chain)?.type === WalletType.EVM) return isValidEvmAddress(address);
  if (chains.get(chain)?.type === WalletType.TON) return isValidTonAddress(address);

  if (chain === Network.Omni) return isValidNearAddress(address, { allowWithoutDomain: true, allowSubdomain: false });
  if (chain === Network.Near) return isValidNearAddress(address);
  if (chain === Network.Solana) return isValidSolanaAddress(address);
  if (chain === Network.Tron) return isValidTronAddress(address);
  if (chain === Network.Btc) return isValidBtcAddress(address);
  if (chain === Network.Stellar) return isValidStellarAddress(address);
  return false;
};
