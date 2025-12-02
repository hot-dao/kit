import { FinalExecutionOutcome } from "@near-js/types";
import { rpc } from "../near/rpc";

const API_KEY =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjUtMDQtMjMtdjEifQ.eyJ2IjoxLCJrZXlfdHlwZSI6InNvbHZlciIsInBhcnRuZXJfaWQiOiJob3QiLCJpYXQiOjE3NjQ2OTI3MTAsImV4cCI6MTc5NjIyODcxMH0.XKgreb8bIxThnKiQrzBtaGhFZGMBwrB0QXwdjGGhYyIupn0BBpXZyALt4YeClPOuimXp8e_at5mAb1cLeQMHuk54NDNouV1qchHsAqmGkouP4sqIufSy9P2X1-8ZWkH2EfU1Kdc22O6A7i7ztRZaDoi5jkCbESnKne81zV9tcTAXOcbyuoHaePprgRfTvuB8GGQ4_2Pj39J9bGyqsAtS0HocDUpee6udS6O_aMklZtiIQzZzg2DbwkrkmLDQ9um0g5iKWy4ZXS3REYNuhC6JEFeF84FIqS9FTPMPIi5H9qzt0EmlmvPJia2s2nl0nh7n4hCacCNT0SFjhYMKuhEJfQ";

class IntentsManager {
  async publishSignedIntents(signed: Record<string, any>[], hashes: string[] = []): Promise<string> {
    const res = await fetch("https://solver-relay-v2.chaindefuser.com/rpc", {
      headers: { "Content-Type": "application/json", Authorization: API_KEY },
      method: "POST",
      body: JSON.stringify({
        params: [{ signed_datas: signed, quote_hashes: hashes }],
        method: "publish_intents",
        id: "dontcare",
        jsonrpc: "2.0",
      }),
    });

    const { result } = await res.json();
    if (result.status === "FAILED") throw result.reason;
    const intentResult = result.intent_hashes[0];

    const getStatus = async () => {
      const statusRes = await fetch("https://solver-relay-v2.chaindefuser.com/rpc", {
        headers: { "Content-Type": "application/json", Authorization: API_KEY },
        method: "POST",
        body: JSON.stringify({
          params: [{ intent_hash: intentResult }],
          method: "get_status",
          id: "dontcare",
          jsonrpc: "2.0",
        }),
      });

      const { result } = await statusRes.json();
      return result;
    };

    const fetchResult = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const result = await getStatus().catch(() => null);
      if (result == null) return await fetchResult();
      if (result.status === "SETTLED") return result.data.hash;
      if (result.status === "FAILED") throw result.reason || "Failed to publish intents";
      return await fetchResult();
    };

    const hash = await fetchResult();
    return hash;
  }

  async hasPublicKey(accountId: string, publicKey: string): Promise<boolean> {
    return await rpc.viewMethod({
      args: { account_id: accountId, public_key: publicKey },
      methodName: "has_public_key",
      contractId: "intents.near",
    });
  }

  async hasNearAccount(accountId: string): Promise<boolean> {
    const keys = await rpc.viewAccessKeyList(accountId);
    return keys.keys.length > 0;
  }

  async simulateIntents(signed: Record<string, any>[]) {
    return await this.viewMethod({
      args: { signed: signed },
      method: "simulate_intents",
      contractId: "intents.near",
    });
  }

  async getIntentsBalances(assets: string[], accountId: string): Promise<Record<string, bigint>> {
    const balances = await this.viewMethod({
      args: { token_ids: assets, account_id: accountId },
      method: "mt_batch_balance_of",
      contractId: "intents.near",
    });

    return Object.fromEntries(assets.map((asset, index) => [asset, BigInt(balances[index] || 0n)]));
  }

  async getIntentsAssets(accountId: string): Promise<string[]> {
    const assets: string[] = [];
    const limit = 250;
    let fromIndex = 0n;

    for (;;) {
      const balances = await this.viewMethod({
        args: { account_id: accountId, from_index: fromIndex.toString(), limit },
        method: "mt_tokens_for_owner",
        contractId: "intents.near",
      });

      assets.push(...balances.map((b: any) => b.token_id));
      if (balances.length < limit) break;
      fromIndex += BigInt(limit);
    }

    return assets;
  }

  async viewMethod({ contractId, method, args }: { contractId: string; method: string; args: Record<string, any> }) {
    return await rpc.viewMethod({ contractId, methodName: method, args });
  }

  parseReceipts = (logs: FinalExecutionOutcome) => {
    const errors: any[] = [];

    logs.receipts_outcome?.forEach((t) => {
      const status = t.outcome.status;
      if (typeof status === "string" && status === "Failure") errors.push(status);
      else if (typeof status === "object" && "Failure" in status) errors.push(status.Failure);
    });

    if (errors.length > 0) {
      const ExecutionError = errors[0]?.ActionError?.kind?.FunctionCallError?.ExecutionError;
      if (ExecutionError) throw ExecutionError;
      const err = JSON.stringify(errors, null, 2);
      throw new Error(err);
    }

    return logs;
  };

  waitTransactionResult = async (txHash: string, accountId: string, attemps = 0, signal?: AbortSignal, total = 30): Promise<FinalExecutionOutcome> => {
    if (signal?.aborted) throw new Error("Aborted");
    if (attemps > total) throw new Error("Transaction not found");

    const options = { tx_hash: txHash, sender_account_id: accountId, wait_until: "EXECUTED" };
    const logs: any = await rpc.sendJsonRpc("EXPERIMENTAL_tx_status", options).catch(() => null);
    if (signal?.aborted) throw new Error("Aborted");

    if (logs == null || logs.status === "NotStarted" || logs.transaction == null) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await this.waitTransactionResult(txHash, accountId, attemps + 1, signal);
    }

    return this.parseReceipts(logs);
  };
}

export const Intents = new IntentsManager();
