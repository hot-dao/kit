import type { Keplr } from "@keplr-wallet/provider-extension";
import { TxRaw, AuthInfo, TxBody } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import { createWasmAminoConverters, wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { defaultRegistryTypes, SigningStargateClient } from "@cosmjs/stargate";
import { AminoTypes, createDefaultAminoConverters } from "@cosmjs/stargate";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { OfflineSigner, Registry } from "@cosmjs/proto-signing";

export const signAndSendTx = async (keplr: Keplr, rpcEndpoint: string, signDoc: any) => {
  const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  const aminoTypes = new AminoTypes({ ...createDefaultAminoConverters(), ...createWasmAminoConverters() });

  const account = await keplr.getKey(signDoc.chainId);
  const offlineSigner = await keplr.getOfflineSignerAuto(signDoc.chainId);
  const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner as OfflineSigner, { registry, aminoTypes });

  const authInfo = AuthInfo.decode(signDoc.authInfoBytes);
  const txBody = TxBody.decode(signDoc.bodyBytes);

  const sequence = authInfo.signerInfos[0].sequence.toString();
  const gas = authInfo.fee?.gasLimit.toString() || "0";

  const txRaw: TxRaw = await client.sign(
    account.bech32Address, //
    txBody.messages.map((msg) => ({ typeUrl: msg.typeUrl, value: MsgExecuteContract.decode(msg.value) })),
    { amount: authInfo.fee?.amount || [], gas },
    txBody.memo || "",
    {
      accountNumber: Number(signDoc.accountNumber),
      sequence: Number(sequence),
      chainId: signDoc.chainId,
    }
  );

  const result = await client.broadcastTx(TxRaw.encode(txRaw).finish());
  if (result.code !== 0) throw "Transaction failed";
  return result.transactionHash;
};
