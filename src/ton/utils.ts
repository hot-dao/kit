import { Address, beginCell, Cell, loadStateInit, toNano } from "@ton/core";
import { Maybe } from "@ton/core/dist/utils/maybe";
import { JettonBalance, TonApiClient } from "@ton-api/client";
import { GlobalSettings } from "../settings";

export const tonApi = new TonApiClient({ baseUrl: "https://tonapi.io", apiKey: GlobalSettings.tonApi });

export const jettonTransferAmount = toNano(0.1);
export const jettonTransferForwardAmount = BigInt(1);

export enum JettonExtension {
  NonTransferable = "non_transferable",
  CustomPayload = "custom_payload",
}

const seeIfCompressed = (jetton: JettonBalance) => {
  return !!jetton.extensions && jetton.extensions.includes(JettonExtension.CustomPayload);
};

export type StateInit = ReturnType<typeof toStateInit>;
export const toStateInit = (stateInit?: string): { code: Maybe<Cell>; data: Maybe<Cell> } | undefined => {
  if (!stateInit) return undefined;
  const { code, data } = loadStateInit(Cell.fromBase64(stateInit).asSlice());
  return { code, data };
};

export const getJettonCustomPayload = async (walletAddress: Address, token: Address): Promise<{ jettonWallet: Address; customPayload: Cell | null; stateInit?: StateInit }> => {
  const jetton = await tonApi.accounts.getAccountJettonBalance(walletAddress, token, { supported_extensions: ["custom_payload"] });
  const jettonWallet = jetton.walletAddress.address;

  if (!seeIfCompressed(jetton)) return { jettonWallet, customPayload: null, stateInit: undefined };
  const { customPayload, stateInit } = await tonApi.jettons.getJettonTransferPayload(walletAddress, jetton.jetton.address);

  return {
    customPayload: customPayload ? Cell.fromBase64(Buffer.from(customPayload, "hex").toString("base64")) : null,
    stateInit: stateInit ? toStateInit(Buffer.from(stateInit, "hex").toString("base64")) : undefined,
    jettonWallet,
  };
};

export const jettonTransferBody = (params: { queryId: bigint; jettonAmount: bigint; toAddress: Address; responseAddress: Address; forwardAmount: bigint; forwardPayload: Cell | null; customPayload: Cell | null }) => {
  return beginCell()
    .storeUint(0xf_8a_7e_a5, 32) // request_transfer op
    .storeUint(params.queryId, 64)
    .storeCoins(params.jettonAmount)
    .storeAddress(params.toAddress)
    .storeAddress(params.responseAddress)
    .storeMaybeRef(params.customPayload) // null custom_payload
    .storeCoins(params.forwardAmount)
    .storeMaybeRef(params.forwardPayload) // storeMaybeRef put 1 bit before cell (forward_payload in cell) or 0 for null (forward_payload in slice)
    .endCell();
};

export const createJettonTransferMsgParams = async ({ jetton, amount, recipient, address, forwardPayload }: { address: Address; recipient: Address; jetton: Address; amount: bigint; forwardPayload: Cell | null }) => {
  const { jettonWallet, customPayload, stateInit } = await getJettonCustomPayload(address, jetton);
  const body = jettonTransferBody({
    queryId: 0n,
    jettonAmount: amount,
    toAddress: recipient,
    responseAddress: address,
    forwardAmount: 1n,
    forwardPayload,
    customPayload,
  });

  return {
    to: jettonWallet,
    value: jettonTransferAmount,
    init: stateInit,
    body: body,
    bounce: true,
  };
};
