import { TokenResponse } from "@defuse-protocol/one-click-sdk-typescript";

import { WalletType } from "./OmniWallet";
import { Chains, Network } from "./chains";

export const chainsMap: Record<number, string> = {
  [Network.Juno]: "juno-1",
  [Network.Gonka]: "gonka-mainnet",
  [Network.Monad]: "monad",
  [Network.Near]: "near",
  [Network.Eth]: "eth",
  [Network.Solana]: "sol",
  [Network.Arbitrum]: "arb",
  [Network.Base]: "base",
  [Network.Bnb]: "bsc",
  [Network.Polygon]: "pol",
  [Network.Avalanche]: "avax",
  [Network.Optimism]: "op",
  [Network.Gnosis]: "gnosis",
  [Network.Ton]: "ton",
  [Network.Stellar]: "stellar",
  [Network.Btc]: "btc",
  [Network.Berachain]: "bera",
  [Network.Tron]: "tron",
  [Network.Zcash]: "zec",
  [Network.Xrp]: "xrp",
  [Network.Doge]: "doge",
  [Network.Ada]: "ada",
  [Network.Aptos]: "aptos",
  [Network.Sui]: "sui",
};

const reverseChainsMap = Object.fromEntries(Object.entries(chainsMap).map(([key, value]) => [value, +key]));

export interface Token {
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

  constructor(readonly info: TokenResponse & { omni?: true }) {
    this.originalChain = reverseChainsMap[info.blockchain];
    this.originalAddress = info.contractAddress || "native";
    this.chain = info.omni ? -4 : reverseChainsMap[info.blockchain];
    this.address = info.omni ? info.assetId : info.contractAddress || "native";
    this.decimals = info.decimals;
    this.symbol = info.symbol;
    this.usd = info.price;
    this.omniAddress = info.assetId;
  }

  get chainIcon() {
    if (this.chain === Network.Juno) return "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
    return Chains.get(this.chain).icon;
  }

  get id() {
    return `${this.chain}:${this.address}`;
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
    return WalletType.EVM;
  }

  get icon() {
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

type Value = number | bigint | string;
export const formatter = {
  toReadableNumber(decimals: number | bigint, number: bigint | string = "0"): string {
    number = number.toString();
    if (!decimals) return number;

    decimals = Number(decimals);
    const wholeStr = number.substring(0, number.length - decimals) || "0";
    const fractionStr = number
      .substring(number.length - decimals)
      .padStart(decimals, "0")
      .substring(0, decimals);

    return `${wholeStr}.${fractionStr}`.replace(/\.?0+$/, "");
  },

  truncateAddress(address: string, length = 16) {
    return address.length > length ? `${address.slice(0, length / 2)}...${address.slice(-length / 2)}` : address;
  },

  toNonDivisibleNumber(decimals: number | bigint, number: string): string {
    if (decimals === null || decimals === undefined) return number;
    decimals = Number(decimals);
    const [wholePart, fracPart = ""] = number.includes("e") ? Number(number).toFixed(24).split(".") : number.split(".");
    return `${wholePart}${fracPart.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^0+/, "").padStart(1, "0");
  },

  formatAmount(n: number | string | bigint, d: number, r?: number) {
    const int = formatter.toReadableNumber(d, n?.toString() || "0");
    return r ? formatter.round(int, r) : +int;
  },

  parseAmount(n: string | number | bigint, d: number) {
    return formatter.toNonDivisibleNumber(d, (n || 0).toString());
  },

  bigIntMax(...args: bigint[]) {
    return args.reduce((m, e) => (e > m ? e : m));
  },

  bigIntMin(...args: bigint[]) {
    return args.reduce((m, e) => (e < m ? e : m));
  },

  formatNumberWithSubscriptZeros(numberStr: string, presiction = 3, min = 0.000_01): string {
    const number = Number.parseFloat(numberStr);
    if (number >= min) {
      const [part0, part1] = numberStr.split(".");
      if (part1) {
        const leadingZeros = part1?.match?.(/^0+/)?.[0] || "";
        return `${part0}.${leadingZeros}${part1.replace(leadingZeros, "").slice(0, presiction)}`;
      }
      return part1 ? [part0, part1.slice(0, presiction)].join(".") : part0;
    }

    const leadingZerosMatch = numberStr.match(/^0\.(0+)/);
    if (!leadingZerosMatch) return numberStr;

    const leadingZerosCount = leadingZerosMatch[1].length;
    const remainingDigits = numberStr.slice(leadingZerosMatch[0].length);

    const smallCount = String(leadingZerosCount)
      .split("")
      .map((digit) => String.fromCharCode(8320 + Number.parseInt(digit)))
      .join("");

    return `0.0${smallCount}${remainingDigits.slice(0, presiction)}`;
  },

  formatNumberWithZeros(numberStr: Value, presiction = 3, min = 0.000_01): string {
    const number = Number.parseFloat(numberStr.toString());
    numberStr = formatter.fixed(numberStr, 24);

    if (number >= min) {
      const [part0, part1] = numberStr.split(".");
      if (part1) {
        const leadingZeros = part1?.match?.(/^0+/)?.[0] || "";
        return `${part0}.${leadingZeros}${part1.replace(leadingZeros, "").slice(0, presiction)}`;
      }
      return part1 ? [part0, part1.slice(0, presiction)].join(".") : part0;
    }

    const leadingZerosMatch = numberStr.match(/^0\.(0+)/);
    if (!leadingZerosMatch) return numberStr;

    const remainingDigits = numberStr.slice(leadingZerosMatch[0].length);
    return `0.0${leadingZerosMatch[1] || ""}${remainingDigits.slice(0, presiction)}`;
  },

  isBig(n: number) {
    return formatter.readableBigParts(n)[1] !== "";
  },

  round(value: Value, dec = 2) {
    const decimal = Math.pow(10, dec);
    return Math.floor(formatter.num(value) * decimal) / decimal;
  },

  readableBig(n: number) {
    if (n < 10_000) return formatter.amount(n);
    if (n < 1_000_000) return `${formatter.round(n / 1000, 2)}K`;
    if (n < 1_000_000_000) return `${formatter.round(n / 1_000_000, 2)}M`;
    if (n < 1_000_000_000_000) return `${formatter.round(n / 1_000_000_000, 2)}B`;
    if (n < 1_000_000_000_000_000) return `${formatter.round(n / 1_000_000_000_000, 2)}T`;
    return `${formatter.round(n / 1_000_000_000_000_000, 2)}Q`;
  },

  readableBigParts(n: number): [number, string] {
    if (n < 10_000) return [formatter.round(n, 4), ""];
    if (n < 1_000_000) return [formatter.round(n / 1000, 2), "K"];
    if (n < 1_000_000_000_000) return [formatter.round(n / 1_000_000, 2), "M"];
    return [formatter.round(n / 1_000_000_000, 2), "B"];
  },
  formatNumber(num: string) {
    let useDelimeter = false;
    let right = "";
    let left = "";

    if (num.startsWith("0") && num.length > 1 && !num.startsWith("0.")) {
      num = num.slice(1);
    }

    const chars = num.split("");
    chars.forEach((char) => {
      const isNumber = char >= "0" && char <= "9";
      if (isNumber && useDelimeter) right += char;
      else if (isNumber && !useDelimeter) left += char;
      else if (char === "." || char.toLowerCase() === "б" || char.toLowerCase() === "ю") {
        if (left == "") left = "0";
        useDelimeter = true;
      }
    });

    return useDelimeter ? `${left}.${right}` : `${left}`;
  },

  fixed(v: Value, dec = 20) {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(12, Math.max(0, Math.floor(dec))),
      useGrouping: true,
    }).format(formatter.num(v));
  },

  fromInput(value: Value) {
    return formatter.formatNumber(value?.toString() ?? "0");
  },

  trim(value: Value) {
    return formatter.fromInput(formatter.formatNumberWithZeros(formatter.fromInput(value?.toString() ?? "0")));
  },

  amount(value: Value, decimals = 24) {
    if (formatter.isBig(Number(value))) {
      const num = formatter.readableBigParts(Number(value));
      return `${num[0]}${num[1]}`;
    }
    const num = formatter.fixed(formatter.num(value), decimals);
    return formatter.formatNumberWithSubscriptZeros(num, 3, 0.0001);
  },

  num(value: Value) {
    if (value == null) return 0;
    return Number.isNaN(Number(value)) ? 0 : Number(value);
  },
};
