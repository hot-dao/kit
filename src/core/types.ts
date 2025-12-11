export interface TransferIntent {
  intent: "transfer";
  tokens: Record<string, string>;
  receiver_id: string;
  memo?: string;
  msg?: string;
  min_gas?: string;
}

export interface TokenDiffIntent {
  intent: "token_diff";
  diff: Record<string, string>;
}

export interface MtWithdrawIntent {
  intent: "mt_withdraw";
  amounts: string[];
  receiver_id: string;
  token_ids: string[];
  token: string;
  memo?: string;
  msg?: string;
  min_gas?: string;
}

export interface FtWithdrawIntent {
  intent: "ft_withdraw";
  memo?: string;
  receiver_id: string;
  token: string;
  amount: string;
  msg?: string;
}

export interface AuthCallIntent {
  min_gas: string;
  attached_deposit: string;
  contract_id: string;
  msg: string;
  intent: "auth_call";
}

export interface Commitment {
  signature: string;
  public_key?: string;
  payload: Record<string, any> | string;
  standard: string;
}
