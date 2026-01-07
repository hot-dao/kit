import { TokenResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { Asset, Networks } from "@stellar/stellar-base";

import { Network, OmniToken, WalletType, chains } from "./chains";
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
  omniAddress: string;
  originalChain: number;
  originalAddress: string;
  originalChainSymbol: string;

  constructor(readonly info: TokenResponse & { omni?: true }) {
    this.originalChainSymbol = info.blockchain;
    this.originalChain = chains.getByKey(info.blockchain)?.id || 0;
    this.chain = info.omni ? -4 : chains.getByKey(info.blockchain)?.id || 0;

    if (this.originalChain === Network.Near) {
      this.address = info.contractAddress === "wrap.near" ? "native" : info.contractAddress || "native";
      this.originalAddress = this.address;
    } else if (this.originalChain === Network.Stellar) {
      this.address = info.contractAddress ? new Asset(info.symbol, info.contractAddress).contractId(Networks.PUBLIC) : "native";
      this.originalAddress = this.address;
    } else {
      this.address = info.contractAddress || "native";
      this.originalAddress = info.contractAddress || "native";
    }

    if (info.omni) {
      this.originalAddress = this.address;
      this.address = info.assetId;
    }

    this.symbol = info.symbol === "wNEAR" ? "NEAR" : info.symbol;
    this.omniAddress = info.assetId;
    this.decimals = info.decimals;
  }

  get usd() {
    return this.info.price;
  }

  get chainIcon() {
    return chains.get(this.chain)?.logo || `https://storage.herewallet.app/ft/${this.chain}:native.png`;
  }

  get originalChainIcon() {
    if (this.originalChain === Network.Juno) return "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
    return `https://storage.herewallet.app/ft/${this.originalChain}:native.png`;
  }

  get chainName() {
    return chains.get(this.chain)?.name || this.originalChainSymbol;
  }

  get id() {
    return `${this.chain}:${this.address}`;
  }

  get isMainOmni() {
    if (this.chain !== Network.Hot) return false;
    return Object.values(OmniToken).some((token) => this.address === token);
  }

  get type() {
    return chains.get(this.chain)?.type || WalletType.unknown;
  }

  get originalType() {
    return chains.get(this.originalChain)?.type || WalletType.unknown;
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
