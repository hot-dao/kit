import { SendTransactionRequest, SignDataPayload, SignDataResponse } from "@tonconnect/ui";
import { Address, comment, SenderArguments, toNano } from "@ton/core";
import { JettonVerificationType } from "@ton-api/client";
import { toUserFriendlyAddress } from "@tonconnect/ui";
import { base58, base64, hex } from "@scure/base";

import { OmniWallet } from "../core/OmniWallet";
import { Network, WalletType } from "../core/chains";
import { ReviewFee } from "../core/bridge";
import { Token } from "../core/token";

import { createJettonTransferMsgParams, tonApi } from "./utils";

interface ProtocolWallet {
  sendTransaction?: (params: SendTransactionRequest) => Promise<unknown>;
  signData?: (params: SignDataPayload) => Promise<SignDataResponse>;
  account: { address: string; publicKey?: string };
}

class TonWallet extends OmniWallet {
  readonly icon = "https://storage.herewallet.app/upload/3ffa61e237f8e38d390abd60200db8edff3ec2b20aad0cc0a8c7a8ba9c318124.png";
  readonly type = WalletType.TON;

  constructor(readonly wallet: ProtocolWallet) {
    super();
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

  async fetchBalances(chain: number): Promise<Record<string, bigint>> {
    if (chain === Network.Omni) return await super.fetchBalances(chain);
    try {
      return await super.fetchBalances(chain);
    } catch {
      const native = await this.fetchBalance(chain, "native");
      const { balances } = await tonApi.accounts.getAccountJettonsBalances(Address.parse(this.address), { supported_extensions: ["custom_payload"] });
      const list: Record<string, bigint> = {};

      balances.map((data) => {
        const jetton = data.jetton.address.toString();
        if (data.walletAddress.isScam || data.jetton.verification === JettonVerificationType.Blacklist) return;
        list[jetton] = BigInt(data.balance);
      });

      Object.entries(list).forEach(([address, balance]) => this.setBalance(`${chain}:${address}`, balance));
      return { ...list, native };
    }
  }

  async fetchBalance(chain: number, address: string) {
    if (chain !== Network.Ton) return super.fetchBalance(chain, address);
    const owner = Address.parse(this.address);

    if (address === "native") {
      const balance = await tonApi.accounts.getAccount(owner);
      return this.setBalance(`${Network.Ton}:${address}`, BigInt(balance.balance));
    }

    const jetton = await tonApi.accounts.getAccountJettonBalance(owner, Address.parse(address), { supported_extensions: ["custom_payload"] });
    return this.setBalance(`${Network.Ton}:${address}`, BigInt(jetton.balance));
  }

  async waitNextSeqno(seqno: number): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const nextSeqno = await tonApi.wallet.getAccountSeqno(Address.parse(this.address)).catch(() => ({ seqno: 0 }));
    if (seqno >= nextSeqno.seqno) return await this.waitNextSeqno(seqno);
    return nextSeqno.seqno;
  }

  async waitTransactionByMessageHash(pending: { prevHash?: string; seqno: number; timestamp: number; lt: bigint }, attemps = 0): Promise<string> {
    if (attemps > 3) return "";

    await new Promise((resolve) => setTimeout(resolve, 5000));
    const res = await tonApi.blockchain.getBlockchainAccountTransactions(Address.parse(this.address), { limit: 1, after_lt: BigInt(pending.lt) });

    const tx = res?.transactions?.[0];
    if (!tx) return await this.waitTransactionByMessageHash(pending, attemps + 0.5);
    if (tx.hash === pending.prevHash) return await this.waitTransactionByMessageHash(pending, attemps + 1);
    if (!tx.success) throw tx.computePhase?.exitCodeDescription || "Transaction failed";
    return tx.hash;
  }

  async sendTransaction(msgs: SenderArguments[]) {
    if (!this.wallet.sendTransaction) throw "Not impl";
    const response = await tonApi.blockchain.getBlockchainAccountTransactions(Address.parse(this.address), { limit: 1 });
    const { seqno } = await tonApi.wallet.getAccountSeqno(Address.parse(this.address));
    const lastTransaction = response.transactions?.[0];

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
      prevHash: lastTransaction?.hash || "",
      lt: lastTransaction?.lt || 0n,
      timestamp: Date.now(),
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

  async signIntents(intents: Record<string, unknown>[], options?: { deadline?: number; nonce?: Uint8Array }) {
    if (!this.wallet.signData) throw "Not impl";
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
