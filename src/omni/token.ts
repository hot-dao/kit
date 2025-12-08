import { TokenResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { Asset, Networks } from "@stellar/stellar-base";

import { Network, OmniToken, WalletType, chainsMap, reverseChainsMap } from "./config";
import { formatter } from "./utils";

export interface IToken {
  chain: number;
  address: string;
  decimals: number;
  symbol: string;
}

export class Token {
  chain: number;
  address: string;
  decimals: number;
  symbol: string;
  usd: number;
  omniAddress: string;
  originalChain: number;
  originalAddress: string;
  originalChainSymbol: string;

  constructor(readonly info: TokenResponse & { omni?: true }) {
    this.originalChainSymbol = info.blockchain;
    this.originalChain = reverseChainsMap[info.blockchain];
    this.chain = info.omni ? -4 : reverseChainsMap[info.blockchain];

    if (this.chain === Network.Near) {
      this.address = info.contractAddress === "wrap.near" ? "native" : info.contractAddress || "native";
      this.originalAddress = this.address;
    } else if (this.chain === Network.Stellar) {
      this.address = info.contractAddress ? new Asset(info.symbol, info.contractAddress).contractId(Networks.PUBLIC) : "native";
      this.originalAddress = this.address;
    } else {
      this.address = info.omni ? info.assetId : info.contractAddress || "native";
      this.originalAddress = info.contractAddress || "native";
    }

    this.decimals = info.decimals;
    this.symbol = info.symbol === "wNEAR" ? "NEAR" : info.symbol;
    this.usd = info.price;
    this.omniAddress = info.assetId;
  }

  get chainIcon() {
    return chainsMap[this.chain]?.logo || `https://storage.herewallet.app/ft/${this.chain}:native.png`;
  }

  get originalChainIcon() {
    if (this.originalChain === Network.Juno) return "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
    return `https://storage.herewallet.app/ft/${this.originalChain}:native.png`;
  }

  get chainName() {
    return chainsMap[this.chain]?.name || this.originalChainSymbol;
  }

  get id() {
    return `${this.chain}:${this.address}`;
  }

  get isMainOmni() {
    if (this.chain !== Network.Hot) return false;
    return Object.values(OmniToken).some((token) => this.address === token);
  }

  get type() {
    if (this.chain === Network.Hot) return WalletType.OMNI;
    if (this.chain === Network.Near) return WalletType.NEAR;
    if (this.chain === Network.Solana) return WalletType.SOLANA;
    if (this.chain === Network.OmniTon) return WalletType.TON;
    if (this.chain === Network.Ton) return WalletType.TON;
    if (this.chain === Network.Stellar) return WalletType.STELLAR;
    if (this.chain === Network.Juno) return WalletType.COSMOS;
    if (this.chain === Network.Gonka) return WalletType.COSMOS;
    if (this.chain === Network.Btc) return WalletType.Btc;
    if (this.chain === Network.Tron) return WalletType.Tron;
    if (this.chain === Network.Zcash) return WalletType.Zcash;
    if (this.chain === Network.Xrp) return WalletType.Xrp;
    if (this.chain === Network.Doge) return WalletType.Doge;
    if (this.chain === Network.Ada) return WalletType.Ada;
    if (this.chain === Network.Aptos) return WalletType.Aptos;
    if (this.chain === Network.Sui) return WalletType.Sui;
    if (this.chain === Network.Litecoin) return WalletType.Litecoin;
    if (this.chain === Network.Cardano) return WalletType.Cardano;
    if (this.chain > 0) return WalletType.EVM;
    return WalletType.unknown;
  }

  get reserve() {
    if (this.chain === Network.Gonka) return 0.01;
    if (this.chain === Network.Juno) return 0.01;

    if (this.address !== "native") return 0;
    if (this.chain === Network.Hot) return 0;
    if (this.chain === Network.Ton) return 0.01;
    if (this.chain === Network.Stellar) return 0;
    if (this.chain === Network.Solana) return 0.001;
    if (this.chain === Network.Near) return 0.01;
    if (this.usd === 0) return 0;

    if (this.chain === Network.Eth) return 2 / this.usd;
    return 0.1 / this.usd;
  }

  get icon() {
    if (this.chain === Network.Hot) return `https://storage.herewallet.app/ft/${this.originalChain}:${this.originalAddress.toLowerCase()}.png`;
    return `https://storage.herewallet.app/ft/${this.id.toLowerCase()}.png`;
  }

  float(t: number | bigint | string) {
    return formatter.formatAmount(t, this.decimals);
  }

  int(t: number | bigint | string) {
    return BigInt(formatter.parseAmount(t.toString(), this.decimals));
  }

  readable(t: number | bigint | string, rate = 1) {
    const n = typeof t === "number" ? t : formatter.formatAmount(t ?? 0, this.decimals);
    return formatter.amount(n * rate);
  }
}
