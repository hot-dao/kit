import { Keplr } from "@keplr-wallet/provider-extension";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import { StargateClient } from "@cosmjs/stargate";
import { hex } from "@scure/base";

import { WalletType } from "../omni/config";
import { HotConnector } from "../HotConnector";
import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { OmniWallet } from "../omni/OmniWallet";
import CosmosWallet from "./wallet";

export interface CosmosConnectorOptions {
  config: { chain: string; rpc: string; denom: string; prefix: string }[];
}

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.COSMOS];
  icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  name = "Cosmos Wallet";
  isSupported = true;
  id = "cosmos";

  config: { chain: string; rpc: string; denom: string; prefix: string }[];

  constructor(wibe3: HotConnector, options?: CosmosConnectorOptions) {
    super(wibe3);

    this.options = [{ name: "Keplr", icon: "https://cdn.prod.website-files.com/667dc891bc7b863b5397495b/68a4ca95f93a9ab64dc67ab4_keplr-symbol.svg", id: "keplr", download: "https://www.keplr.app/get" }];
    this.config = options?.config || [
      { chain: "juno-1", rpc: "https://juno-rpc.publicnode.com", denom: "ujuno", prefix: "juno" },
      { chain: "gonka-mainnet", rpc: "https://dev.herewallet.app/api/v1/evm/rpc/4444119", denom: "ngonka", prefix: "gonka" },
    ];

    this.getStorage().then(({ type, address, publicKey }) => {
      if (!address || !publicKey) return;
      if (type === "keplr") this.setKeplrWallet(address, publicKey);
    });
  }

  getConfig(chain: string) {
    return this.config.find((c) => c.chain === chain);
  }

  async createWallet(address: string): Promise<OmniWallet> {
    return new CosmosWallet(this, { address });
  }

  async setKeplrWallet(address: string, publicKey: string) {
    const keplr = await Keplr.getKeplr();
    if (!keplr) throw new Error("Keplr not found");

    return this.setWallet(
      new CosmosWallet(this, {
        address: address,
        publicKey: publicKey,
        disconnect: () => keplr.disable(),
        sendTransaction: async (signDoc: any, opts = { preferNoSetFee: true }) => {
          await keplr.enable(this.config.map((c) => c.chain));

          const account = await keplr.getKey(signDoc.chainId);
          const protoSignResponse = await keplr.signDirect(signDoc.chainId, account.bech32Address, signDoc, opts);
          const client = await StargateClient.connect(this.getConfig(signDoc.chainId)?.rpc || "");

          console.log({ signDoc, account, opts, protoSignResponse });

          // Build a TxRaw and serialize it for broadcasting
          const protobufTx = TxRaw.encode({
            bodyBytes: protoSignResponse.signed.bodyBytes,
            authInfoBytes: protoSignResponse.signed.authInfoBytes,
            signatures: [Buffer.from(protoSignResponse.signature.signature, "base64")],
          }).finish();

          const result = await client.broadcastTx(protobufTx);
          if (result.code !== 0) throw "Transaction failed";
          return result.transactionHash;
        },
      })
    );
  }

  async connect() {
    const keplr = await Keplr.getKeplr();
    if (!keplr) throw new Error("Keplr not found");

    await keplr.experimentalSuggestChain({
      chainId: "gonka-mainnet",
      chainName: "Gonka",
      rpc: "https://gonka04.6block.com:8443/chain-rpc",
      rest: "https://gonka04.6block.com:8443/chain-api",
      bip44: { coinType: 1200 },
      currencies: [{ coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka" }],
      feeCurrencies: [
        {
          coinDenom: "GNK",
          coinMinimalDenom: "ngonka",
          coinDecimals: 9,
          coinGeckoId: "gonka",
          gasPriceStep: { low: 0, average: 0, high: 0 },
        },
      ],
      stakeCurrency: {
        coinDenom: "GNK",
        coinMinimalDenom: "ngonka",
        coinDecimals: 9,
        coinGeckoId: "gonka",
      },
    });

    await keplr.enable(this.config.map((c) => c.chain));
    const account = await keplr.getKey("gonka-mainnet");

    await this.setStorage({ type: "keplr", address: account.bech32Address, publicKey: hex.encode(account.pubKey) });
    return this.setKeplrWallet(account.bech32Address, hex.encode(account.pubKey));
  }

  async silentDisconnect(): Promise<void> {
    this.removeStorage();
  }
}
