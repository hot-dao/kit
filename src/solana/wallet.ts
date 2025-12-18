import { Connection, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { ComputeBudgetProgram, PublicKey, SystemProgram, TransactionMessage } from "@solana/web3.js";
import { base64, base58, hex } from "@scure/base";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getMinimumBalanceForRentExemptAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

import { Network, WalletType } from "../core/chains";
import { OmniWallet } from "../OmniWallet";

import { Token } from "../core/token";
import { formatter } from "../core/utils";
import { ReviewFee } from "../core/bridge";
import { Commitment } from "../core";
import { api } from "../core/api";

import { ISolanaProtocolWallet } from "./WalletStandard";

class SolanaWallet extends OmniWallet {
  readonly icon = "https://storage.herewallet.app/upload/8700f33153ad813e133e5bf9b791b5ecbeea66edca6b8d17aeccb8048eb29ef7.png";
  readonly type = WalletType.SOLANA;

  constructor(readonly wallet: ISolanaProtocolWallet) {
    super();
  }

  getConnection() {
    return new Connection(api.getRpcUrl(Network.Solana), {
      httpHeaders: { "Api-Key": api.apiKey },
    });
  }

  get address() {
    return this.wallet.address;
  }

  get publicKey() {
    return this.wallet.address;
  }

  get omniAddress() {
    return hex.encode(base58.decode(this.address)).toLowerCase();
  }

  async fetchBalance(_: number, address: string) {
    const connection = this.getConnection();

    if (address === "native") {
      const balance = await connection.getBalance(new PublicKey(this.address));
      return BigInt(balance);
    }

    const ATA = getAssociatedTokenAddressSync(new PublicKey(address), new PublicKey(this.address));
    const meta = await connection.getTokenAccountBalance(ATA);
    return BigInt(meta.value.amount);
  }

  async buildTranferInstructions(token: Token, amount: bigint, receiver: string, fee: ReviewFee) {
    const destination = new PublicKey(receiver);
    const owner = new PublicKey(this.address);
    const connection = this.getConnection();

    const reserve = await connection.getMinimumBalanceForRentExemption(0);
    let additionalFee = 0n;

    if (token.address === "native") {
      return {
        reserve,
        additionalFee,
        instructions: [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(fee.priorityFee) }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: Number(fee.gasLimit) }),
          SystemProgram.transfer({ fromPubkey: owner, toPubkey: destination, lamports: amount }),
        ],
      };
    }

    const mint = new PublicKey(token.address);
    const mintAccount = await connection.getAccountInfo(mint);
    const tokenProgramId = mintAccount?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    const tokenFrom = getAssociatedTokenAddressSync(mint, owner, false, tokenProgramId);
    const tokenTo = getAssociatedTokenAddressSync(mint, destination, false, tokenProgramId);

    const instructions: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(fee.baseFee) }), ComputeBudgetProgram.setComputeUnitLimit({ units: Number(fee.gasLimit) })];

    const isRegistered = await getAccount(connection, tokenTo, "confirmed", tokenProgramId).catch(() => null);
    if (isRegistered == null) {
      const inst = createAssociatedTokenAccountInstruction(new PublicKey(this.address), tokenTo, destination, mint, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID);
      instructions.push(inst);
      additionalFee += BigInt(await getMinimumBalanceForRentExemptAccount(connection));
    }

    if (tokenProgramId === TOKEN_2022_PROGRAM_ID) {
      instructions.push(createTransferCheckedInstruction(tokenFrom, mint, tokenTo, owner, amount, token.decimals, [], tokenProgramId));
    } else {
      instructions.push(createTransferInstruction(tokenFrom, tokenTo, owner, amount, [], tokenProgramId));
    }

    return { instructions, additionalFee, reserve };
  }

  async transferFee(token: Token, receiver: string): Promise<ReviewFee> {
    const connection = this.getConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    const fee = new ReviewFee({ chain: Network.Solana, gasLimit: 1_400_000n, baseFee: 100n });
    const { instructions, additionalFee, reserve } = await this.buildTranferInstructions(token, 1n, receiver, fee);

    const msgForEstimate = new TransactionMessage({ payerKey: new PublicKey(this.address), recentBlockhash: blockhash, instructions }).compileToV0Message();
    const tx = new VersionedTransaction(msgForEstimate);

    const priorityFeeData = await this.getPriorityFeeEstimate({
      options: { includeAllPriorityFeeLevels: true },
      transaction: base58.encode(tx.serialize()),
    });

    if (priorityFeeData?.priorityFeeLevels == null) throw "Failed to fetch gas";
    const simulate = await connection.simulateTransaction(tx).catch(() => null);
    const unitsConsumed = formatter.bigIntMax(BigInt(simulate?.value.unitsConsumed || 10_000n), 10_000n);

    const msgFee = await connection.getFeeForMessage(msgForEstimate);
    const medium = BigInt(priorityFeeData.priorityFeeLevels.medium);
    const high = BigInt(priorityFeeData.priorityFeeLevels.high);
    const veryHigh = BigInt(priorityFeeData.priorityFeeLevels.veryHigh);
    const baseFee = BigInt(msgFee.value || 0);

    return new ReviewFee({
      chain: Network.Solana,
      reserve: BigInt(reserve) + additionalFee,
      gasLimit: unitsConsumed,
      baseFee,
      priorityFee: medium,
      options: [
        { priorityFee: medium, baseFee },
        { priorityFee: high, baseFee },
        { priorityFee: veryHigh, baseFee },
      ],
    });
  }

  async getPriorityFeeEstimate(params: any): Promise<any> {
    const response = await fetch(api.baseUrl + "/api/v1/evm/helius/staked", {
      body: JSON.stringify({ jsonrpc: "2.0", id: "helius-sdk", method: "getPriorityFeeEstimate", params: [params] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) throw "Server error";
    const { result, error } = await response.json();
    if (error) throw error.message;
    if (result.error) throw result.error.message;
    return result;
  }

  async transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee: ReviewFee }): Promise<string> {
    const { instructions } = await this.buildTranferInstructions(args.token, args.amount, args.receiver, args.gasFee);
    return await this.sendTransaction(instructions);
  }

  async sendTransaction(instructions: TransactionInstruction[]): Promise<string> {
    if (!this.wallet.sendTransaction) throw "not impl";
    const connection = this.getConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({ payerKey: new PublicKey(this.address), recentBlockhash: blockhash, instructions });
    const transaction = new VersionedTransaction(message.compileToV0Message());
    return await this.wallet.sendTransaction(transaction, connection, { preflightCommitment: "confirmed" });
  }

  async fetchBalances(chain: number, whitelist: string[]): Promise<Record<string, bigint>> {
    const native = await this.fetchBalance(chain, "native");
    const connection = this.getConnection();

    try {
      const res = await fetch(`https://api0.herewallet.app/api/v1/user/balances/${chain}/${this.address}`, { body: JSON.stringify({ whitelist }), method: "POST" });
      const { balances } = await res.json();
      return { ...balances, native };
    } catch {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(this.address), { programId: TOKEN_PROGRAM_ID });
      const balances = Object.fromEntries(
        tokenAccounts.value.map((account) => {
          const { mint, tokenAmount } = account.account.data.parsed.info;
          return [mint, tokenAmount.amount];
        })
      );

      return { ...balances, native };
    }
  }

  async signMessage(message: string) {
    if (!this.wallet.signMessage) throw "not impl";
    return this.wallet.signMessage(message);
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || window.crypto.getRandomValues(new Uint8Array(32)));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      nonce: base64.encode(nonce),
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      intents: intents,
    });

    const signature = await this.signMessage(message);
    return {
      signature: `ed25519:${base58.encode(signature)}`,
      public_key: `ed25519:${this.publicKey}`,
      standard: "raw_ed25519",
      payload: message,
    };
  }
}

export default SolanaWallet;
