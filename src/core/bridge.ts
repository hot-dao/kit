import { CosmosConfig, HotBridge, ReviewFee } from "@hot-labs/omni-sdk";
import { chains, Network, WalletType } from "./chains";
import { Intents } from "./Intents";

export { ReviewFee, HotBridge };

export const createHotBridge = () => {
  return new HotBridge({
    publishIntents: async (signed: Record<string, any>[], hashes: string[] = []) => {
      const hash = await Intents.publishSignedIntents(signed, hashes);
      return { sender: "intents.near", hash };
    },

    solanaRpc: [chains.get(Network.Solana).rpc],
    evmRpc: Object.values(chains.repository)
      .filter((chain) => chain.type === WalletType.EVM)
      .reduce((acc, chain) => {
        acc[chain.id] = [chain.rpc];
        return acc;
      }, {} as Record<string, string[]>),

    logger: console,
    cosmos: {
      ...chains.repository
        .filter((chain) => chain.type === WalletType.COSMOS)
        .reduce((acc, chain) => {
          acc[chain.id] = {
            rpc: chain.rpc,
            contract: chain.bridgeContract || "",
            gasLimit: chain.gasLimit || 200000n,
            nativeToken: chain.currency.id,
            prefix: chain.prefix || "",
            chainId: chain.key,
          };
          return acc;
        }, {} as Record<number, CosmosConfig>),
    },
  });
};
