export interface DefuseAsset {
  defuse_asset_identifier: string; // CHAIN_TYPE:CHAIN_ID:ADDRESS
  near_token_id: string;
  decimals: number;
  asset_name: string;
  min_deposit_amount: string;
  min_withdrawal_amount: string;
  withdrawal_fee: string;
  intents_token_id: string;
}

export interface RecentDeposit {
  tx_hash: string;
  chain: string;
  defuse_asset_identifier: string;
  decimals: number;
  amount: bigint;
  account_id: string;
  address: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
}

export interface WithdrawEstimate {
  tokenAddress: string;
  userAddress: string;
  withdrawalFee: bigint;
  withdrawalFeeDecimals: number;
  token: {
    defuse_asset_identifier: string;
    near_token_id: string;
    decimals: number;
    asset_name: string;
    min_deposit_amount: number;
  };
}

export interface WithdrawStatus {
  status: "COMPLETED" | "PENDING" | "FAILED";
  data: {
    tx_hash: string;
    transfer_tx_hash: string;
    chain: string;
    defuse_asset_identifier: string;
    decimals: number;
    amount: bigint;
    account_id: string;
    address: string;
  };
}

export class DefuseApi {
  async request(method: string, params: Record<string, any>): Promise<any> {
    const response = await fetch(`https://bridge.chaindefuser.com/rpc?method=${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "dontcare",
        jsonrpc: "2.0",
        method: method,
        params: [params],
      }),
    });

    const { result } = await response.json();
    return result;
  }

  private _cachedSupportedTokens: DefuseAsset[] | null = null;
  async getSupportedTokens(chains?: string[]): Promise<DefuseAsset[]> {
    if (this._cachedSupportedTokens) return this._cachedSupportedTokens;
    const { tokens } = await this.request("supported_tokens", { chains });
    this._cachedSupportedTokens = tokens;
    return tokens;
  }

  async getDepositAddress(accountId: string, chain: string, memo: boolean = false): Promise<{ chain: string; address: string; memo?: string }> {
    if (chain === "stellar:mainnet") memo = true; // Stellar mainnet requires memo
    return await this.request("deposit_address", {
      deposit_mode: memo ? "MEMO" : undefined,
      account_id: accountId,
      chain,
    });
  }

  async getRecentDeposits(accountId: string, chain: string): Promise<RecentDeposit[]> {
    return await this.request("recent_deposits", { account_id: accountId, chain });
  }

  async notifyDeposit(txHash: string, depositAddress: string): Promise<void> {
    await this.request("notify_deposit", { tx_hash: txHash, deposit_address: depositAddress });
  }

  async withdrawEstimate(chain: string, token: string, address: string): Promise<WithdrawEstimate> {
    return await this.request("withdraw_estimate", { chain, token, address });
  }

  async getWithdrawalStatus(txHash: string): Promise<WithdrawStatus> {
    return await this.request("withdrawal_status", { withdrawal_hash: txHash });
  }
}

export const defuseApi = new DefuseApi();
