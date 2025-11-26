import { SendTransactionRequest, SignDataPayload, SignDataResponse } from "@tonconnect/ui";
import { Address, comment, SenderArguments, toNano } from "@ton/core";
import { toUserFriendlyAddress } from "@tonconnect/ui";
import { base58, base64, hex } from "@scure/base";

import { OmniWallet } from "../omni/OmniWallet";
import { WalletType } from "../omni/config";
import { createJettonTransferMsgParams, tonApi } from "./utils";
import { OmniConnector } from "../omni/OmniConnector";
import { ReviewFee } from "../omni/fee";
import { Token } from "../omni/token";

interface ProtocolWallet {
  sendTransaction: (params: SendTransactionRequest) => Promise<any>;
  signData: (params: SignDataPayload) => Promise<SignDataResponse>;
  account: { address: string; publicKey?: string };
}

class TonWallet extends OmniWallet {
  readonly type = WalletType.TON;

  constructor(readonly connector: OmniConnector, readonly wallet: ProtocolWallet) {
    super(connector);
  }

  get address() {
    if (!this.wallet.account) throw new Error("No account found");
    return toUserFriendlyAddress(this.wallet.account.address);
  }

  get publicKey() {
    if (!this.wallet.account?.publicKey) throw new Error("No public key found");
    return base58.encode(hex.decode(this.wallet.account.publicKey));
  }

  get omniAddress() {
    if (!this.wallet.account?.publicKey) throw new Error("No public key found");
    return this.wallet.account.publicKey.toLowerCase();
  }

  async fetchBalance(chain: number, address: string) {
    const owner = Address.parse(this.address);

    if (address === "native") {
      const balance = await tonApi.accounts.getAccount(owner);
      return BigInt(balance.balance);
    }

    const jetton = await tonApi.accounts.getAccountJettonBalance(owner, Address.parse(address), { supported_extensions: ["custom_payload"] });
    return BigInt(jetton.balance);
  }

  async waitNextSeqno(seqno: number): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const nextSeqno = await tonApi.wallet.getAccountSeqno(Address.parse(this.address)).catch(() => ({ seqno: 0 }));
    if (seqno >= nextSeqno.seqno) return await this.waitNextSeqno(seqno);
    return nextSeqno.seqno;
  }

  async waitTransactionByMessageHash(pending: { prevHash: string; seqno: number; timestamp: number; lt: bigint }, attemps = 0): Promise<string> {
    if (attemps > 3) return "";

    await new Promise((resolve) => setTimeout(resolve, 5000));
    const res = await tonApi.blockchain.getBlockchainAccountTransactions(Address.parse(this.address), { limit: 1, after_lt: BigInt(pending.lt) });

    const tx = res.transactions[0];
    if (tx.hash === pending.prevHash) return await this.waitTransactionByMessageHash(pending, attemps + 1);
    if (!tx.success) throw tx.computePhase?.exitCodeDescription || "Transaction failed";
    return tx.hash;
  }

  async sendTransaction(msgs: SenderArguments[]) {
    const response = await tonApi.blockchain.getBlockchainAccountTransactions(Address.parse(this.address), { limit: 1 });
    const { seqno } = await tonApi.wallet.getAccountSeqno(Address.parse(this.address));
    const lastTransaction = response.transactions[0];

    await this.wallet.sendTransaction({
      validUntil: Date.now() + 200_000,
      messages: msgs.map((tx) => ({
        address: tx.to.toString({ bounceable: tx.bounce ? true : false }),
        payload: tx.body?.toBoc().toString("base64"),
        stateInit: tx.init?.data?.toBoc().toString("base64"),
        amount: String(tx.value),
      })),
    });

    await this.waitNextSeqno(seqno);
    return await this.waitTransactionByMessageHash({
      timestamp: Date.now(),
      lt: lastTransaction.lt,
      prevHash: lastTransaction.hash,
      seqno,
    });
  }
  async transferFee(): Promise<ReviewFee> {
    return new ReviewFee({ baseFee: toNano(0.005), reserve: toNano(0.05), chain: 1111 });
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }) {
    const memo = args.comment ? comment(args.comment) : null;

    if (args.token.address === "native") {
      const msg = { to: Address.parse(args.receiver), sendMode: 3, bounce: false, value: args.amount, body: memo };
      const tx = await this.sendTransaction([msg]);
      return tx;
    }

    // Jetton transfer
    const msg = await createJettonTransferMsgParams({
      recipient: Address.parse(args.receiver),
      jetton: Address.parse(args.token.address),
      address: Address.parse(this.address),
      forwardPayload: memo,
      amount: args.amount,
    });

    const tx = await this.sendTransaction([msg]);
    return tx;
  }

  async signIntentsWithAuth(domain: string, intents?: Record<string, any>[]) {
    const address = this.wallet.account?.address;
    if (!address) throw new Error("Wallet not connected");

    const seed = hex.encode(window.crypto.getRandomValues(new Uint8Array(32)));
    const msgBuffer = new TextEncoder().encode(`${domain}_${seed}`);
    const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));

    return {
      signed: await this.signIntents(intents || [], { nonce: new Uint8Array(nonce) }),
      publicKey: `ed25519:${this.publicKey}`,
      chainId: WalletType.TON,
      address: address,
      seed,
    };
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }) {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));
    const message = {
      deadline: new Date(Date.now() + 24 * 3_600_000 * 365).toISOString(),
      signer_id: this.omniAddress,
      verifying_contract: "intents.near",
      nonce: base64.encode(nonce),
      intents,
    };

    const result = await this.wallet.signData({ text: JSON.stringify(message), type: "text" });

    return {
      ...result,
      standard: "ton_connect",
      signature: "ed25519:" + base58.encode(base64.decode(result.signature)),
      public_key: `ed25519:${this.publicKey}`,
    };
  }
}

export default TonWallet;
