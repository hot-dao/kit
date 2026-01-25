import { NetworkError, TimeoutNetworkError } from "./api";

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

  formatNumberWithSubscriptZeros(numberStr: string, presiction = 3): string {
    const number = Number.parseFloat(numberStr);
    if (!numberStr.startsWith("0.")) return String(+number.toFixed(presiction));

    const leadingZerosMatch = numberStr.match(/^0\.(0+)/);
    if (!leadingZerosMatch) return String(+number.toFixed(presiction));

    const leadingZerosCount = leadingZerosMatch[1].length;
    if (leadingZerosCount > 2) {
      const remainingDigits = numberStr.slice(leadingZerosMatch[0].length);
      const smallCount = String(leadingZerosCount)
        .split("")
        .map((digit) => String.fromCharCode(8320 + Number.parseInt(digit)))
        .join("");

      return `0.0${smallCount}${remainingDigits.slice(0, presiction)}`;
    }

    return String(+number.toFixed(presiction));
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
    if (+formatter.num(value) > 1_000_000_000_000_000_000) return `${formatter.round(+formatter.num(value) / 1_000_000_000_000_000, 2)}Q`;
    if (+formatter.num(value) > 1_000_000_000_000_000) return `${formatter.round(+formatter.num(value) / 1_000_000_000_000, 2)}T`;
    if (+formatter.num(value) > 1_000_000_000_000) return `${formatter.round(+formatter.num(value) / 1_000_000_000, 2)}B`;
    if (+formatter.num(value) > 1_000_000_000) return `${formatter.round(+formatter.num(value) / 1_000_000, 2)}M`;
    const num = formatter.num(value).toFixed(decimals);
    if (+num === 0) return "0";
    return formatter.formatNumberWithSubscriptZeros(num, 3);
  },

  num(value: Value) {
    if (value == null) return 0;
    return Number.isNaN(Number(value)) ? 0 : Number(value);
  },

  wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  chunk(array: any[], size: number) {
    return array.reduce((acc, item, index) => {
      const chunkIndex = Math.floor(index / size);
      if (!acc[chunkIndex]) {
        acc[chunkIndex] = [];
      }
      acc[chunkIndex].push(item);
      return acc;
    }, []);
  },

  serializeError(error: any): string {
    try {
      if (error instanceof Error) return error.message;
      if (error instanceof NetworkError) return error.toString();
      if (error instanceof TimeoutNetworkError) return error.toString();
      if (typeof error === "object" && Object.keys(error).length > 0) return JSON.stringify(error);
      if (typeof error === "string" || typeof error === "number") return error.toString();
      return "";
    } catch (error) {
      return "Unknown error";
    }
  },
};
