import { base58, base64, hex } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";

import type { OmniConnector } from "../core/OmniConnector";
import { OmniWallet } from "../core/OmniWallet";
import { Network, WalletType, chains } from "../core/chains";
import { Commitment } from "../core";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";

const TRONGRID_API_KEY = "";

function tronBase58ToOmniAddress(base58Address: string) {
  const decoded = base58.decode(base58Address);
  if (decoded.length !== 25) throw new Error("Invalid TRON address");

  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21, 25);
  const check = sha256(sha256(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== check[i]) throw new Error("Invalid TRON address");
  }

  const payloadHex = hex.encode(payload);
  if (!payloadHex.startsWith("41")) throw new Error("Invalid TRON address");
  if (payloadHex.length !== 42) throw new Error("Invalid TRON address");
  return `0x${payloadHex.slice(2)}`.toLowerCase();
}

function tronHeaders() {
  return {
    "content-type": "application/json",
    "TRON-PRO-API-KEY": TRONGRID_API_KEY,
  };
}

function tronReceiverEvmHex(address: string) {
  if (address.startsWith("0x") && address.length === 42) return address.slice(2).toLowerCase();
  return tronBase58ToOmniAddress(address).slice(2).toLowerCase();
}

function abiAddressParam(address: string) {
  return tronReceiverEvmHex(address).padStart(64, "0");
}

function abiUint256Param(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function unwrapSignedTransaction(res: any) {
  if (!res) return null;
  if (res.signature && (res.raw_data || res.raw_data_hex)) return res;
  if (res.result?.signature) return res.result;
  if (res.signedTransaction?.signature) return res.signedTransaction;
  if (res.transaction?.signature) return res.transaction;
  return res;
}

function stripHexPrefix(s: string): string {
  return s.startsWith("0x") ? s.slice(2) : s;
}

function normalizeTronSignature(signatureHex: string): Uint8Array {
  const clean = stripHexPrefix(signatureHex);
  if (clean.length < 130) throw new Error("Invalid signature");
  const rsv = clean.slice(0, 130);
  const v = parseInt(rsv.slice(128, 130), 16);
  const parity = v === 27 || v === 0 ? 0 : v === 28 || v === 1 ? 1 : v % 2;
  const normalized = rsv.slice(0, 128) + (parity === 0 ? "00" : "01");
  return hex.decode(normalized);
}

class TronWalletConnect extends OmniWallet {
  readonly publicKey?: string;
  readonly type = WalletType.Tron;

  constructor(readonly connector: OmniConnector, readonly address: string, readonly chainId: string) {
    super();
  }

  get icon() {
    return this.connector.icon;
  }

  get omniAddress() {
    return tronBase58ToOmniAddress(this.address);
  }

  private get rpc() {
    return "https://api.trongrid.io";
  }

  private async fetchTron(path: string, body: any) {
    const res = await fetch(`${this.rpc}${path}`, {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify(body),
    });
    return await res.json();
  }

  private async trc20Balance(contractAddress: string): Promise<bigint> {
    const parameter = abiAddressParam(this.address);
    const json = await this.fetchTron("/wallet/triggerconstantcontract", {
      owner_address: this.address,
      contract_address: contractAddress,
      function_selector: "balanceOf(address)",
      parameter,
      visible: true,
    });
    const hexBalance = json?.constant_result?.[0];
    if (!hexBalance) return 0n;
    return BigInt(`0x${hexBalance}`);
  }

  async fetchBalance(chain: number, address: string): Promise<bigint> {
    if (chain !== Network.Tron) return super.fetchBalance(chain, address);
    if (address === "native") {
      const json = await this.fetchTron("/wallet/getaccount", { address: this.address, visible: true });
      return this.setBalance(`${chain}:${address}`, BigInt(json?.balance || 0));
    }
    return this.setBalance(`${chain}:${address}`, await this.trc20Balance(address));
  }

  async fetchBalances(chain: number, whitelist: string[]): Promise<Record<string, bigint>> {
    if (chain !== Network.Tron) return await super.fetchBalances(chain, whitelist);
    const tasks = whitelist.map(async (token) => [token, await this.fetchBalance(chain, token)] as const);
    return Object.fromEntries(await Promise.all(tasks));
  }

  async transferFee(token: Token): Promise<ReviewFee> {
    return new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: token.chain });
  }

  private async broadcastTransaction(signedTx: any) {
    const signature = Array.isArray(signedTx.signature) ? signedTx.signature.map(stripHexPrefix) : [stripHexPrefix(signedTx.signature)];

    const body = {
      txID: signedTx.txID,
      raw_data: signedTx.raw_data,
      raw_data_hex: signedTx.raw_data_hex,
      signature,
      visible: signedTx.visible ?? true,
    };

    const res = await fetch(`${this.rpc}/wallet/broadcasttransaction`, {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (json?.result !== true) throw new Error(json?.message || json?.Error || "Broadcast failed");
    return (json?.txid || signedTx?.txID || "") as string;
  }

  private async getWcSession() {
    return await (this.connector as any).wc;
  }

  private async getSessionAddress(): Promise<string> {
    const wc = await this.getWcSession();
    const account = wc?.session?.namespaces?.tron?.accounts?.[0];
    const parts = account?.split(":");
    return parts?.[2] || this.address;
  }

  private async isLegacyFormat(): Promise<boolean> {
    const wc = await this.getWcSession();
    const version = wc?.session?.sessionProperties?.tron_method_version;
    return version !== "v1";
  }

  private async signTransaction(transaction: any): Promise<any> {
    const sessionAddress = await this.getSessionAddress();
    const useLegacy = await this.isLegacyFormat();

    const txData = {
      visible: transaction.visible ?? true,
      txID: transaction.txID,
      raw_data: transaction.raw_data,
      raw_data_hex: transaction.raw_data_hex,
    };

    const params = useLegacy ? { address: sessionAddress, transaction: { transaction: txData } } : { address: sessionAddress, transaction: txData };

    const signed = await this.connector.requestWalletConnect<any>({
      chain: this.chainId,
      request: { method: "tron_signTransaction", params },
      name: "WalletConnect",
      icon: this.connector.icon,
    });

    const got = unwrapSignedTransaction(signed);
    if (!got?.signature?.length) throw new Error("No signature from wallet");

    return {
      txID: got.txID || transaction.txID,
      raw_data: got.raw_data || transaction.raw_data,
      raw_data_hex: got.raw_data_hex || transaction.raw_data_hex,
      signature: got.signature,
      visible: got.visible ?? transaction.visible ?? true,
    };
  }

  private async buildTrxTransfer(ownerAddress: string, receiver: string, amount: bigint) {
    const res = await fetch(`${this.rpc}/wallet/createtransaction`, {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify({ to_address: receiver, owner_address: ownerAddress, amount: Number(amount), visible: true }),
    });
    const json = await res.json();
    if (json?.Error) throw new Error(json.Error);
    return json;
  }

  private async buildTrc20Transfer(ownerAddress: string, contract: string, receiver: string, amount: bigint) {
    const parameter = `${abiAddressParam(receiver)}${abiUint256Param(amount)}`;
    const res = await fetch(`${this.rpc}/wallet/triggersmartcontract`, {
      method: "POST",
      headers: tronHeaders(),
      body: JSON.stringify({
        owner_address: ownerAddress,
        contract_address: contract,
        function_selector: "transfer(address,uint256)",
        parameter,
        fee_limit: 200000000,
        visible: true,
      }),
    });
    const json = await res.json();
    if (json?.Error) throw new Error(json.Error);
    const tx = json?.transaction;
    if (!tx) throw new Error("Failed to build contract transaction");
    return tx;
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    if (args.token.chain !== Network.Tron) return await super.transfer(args);

    const ownerAddress = await this.getSessionAddress();

    let tx;
    if (args.token.address === "native") {
      tx = await this.buildTrxTransfer(ownerAddress, args.receiver, args.amount);
    } else {
      tx = await this.buildTrc20Transfer(ownerAddress, args.token.address, args.receiver, args.amount);
    }

    const signedTx = await this.signTransaction(tx);
    return await this.broadcastTransaction(signedTx);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      nonce: base64.encode(nonce),
      intents,
    });

    const { signature } = await this.connector.requestWalletConnect<{ signature: string }>({
      chain: this.chainId,
      request: { method: "tron_signMessage", params: { address: this.address, message } },
      name: "WalletConnect",
      icon: this.connector.icon,
    });

    const buffer = normalizeTronSignature(signature);
    return {
      signature: `secp256k1:${base58.encode(buffer)}`,
      payload: message,
      standard: "tip191",
    };
  }
}

export default TronWalletConnect;
