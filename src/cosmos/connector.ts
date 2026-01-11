import { Keplr } from "@keplr-wallet/provider-extension";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import { StargateClient } from "@cosmjs/stargate";
import { base64, hex } from "@scure/base";
import { runInAction } from "mobx";

import { api } from "../core/api";
import { chains, WalletType } from "../core/chains";
import { ConnectorType, OmniConnector, OmniConnectorOption, WC_ICON } from "../OmniConnector";
import { HotConnector } from "../HotConnector";
import { OmniWallet } from "../OmniWallet";

import { signAndSendTx } from "./helpers";
import CosmosWallet from "./wallet";

declare global {
  interface Window {
    keplr?: Keplr;
    leap?: Keplr;
  }
}

const wallets: Record<string, OmniConnectorOption> = {
  gonkaWallet: {
    name: "Gonka Wallet",
    icon: "https://gonka-wallet.startonus.com/images/logo.png",
    download: "https://t.me/gonka_wallet",
    deeplink: "https://wallet.gonka.top/wc?wc=",
    type: "external",
    id: "gonkaWallet",
  },
  keplr: {
    name: "Keplr Wallet",
    icon: "https://cdn.prod.website-files.com/667dc891bc7b863b5397495b/68a4ca95f93a9ab64dc67ab4_keplr-symbol.svg",
    download: "https://www.keplr.app/get",
    deeplink: "keplrwallet://wcV2?",
    type: "extension",
    id: "keplr",
  },
  leap: {
    name: "Leap Wallet",
    icon: "https://framerusercontent.com/images/AbGYvbwnLekBbsdf5g7PI5PpSg.png?scale-down-to=512",
    download: "https://www.leapwallet.io/download",
    deeplink: "leapcosmos://wcV2?",
    type: "extension",
    id: "leap",
  },
};

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.COSMOS];
  icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  name = "Cosmos Wallet";
  isSupported = true;
  id = "cosmos";

  constructor(wibe3: HotConnector) {
    super(wibe3);

    this.options = Object.values(wallets);
    Keplr.getKeplr().then((keplr) => {
      const option = this.options.find((option) => option.id === "keplr")!;
      runInAction(() => {
        option.type = keplr ? "extension" : "external";
        option.name = keplr ? "Keplr Wallet" : "Keplr Mobile";
      });
    });

    this.getStorage().then(async ({ type, address, publicKey }) => {
      if (!address || !publicKey) return;

      if (type === "keplr") {
        const keplr = await Keplr.getKeplr();
        if (keplr) this.setKeplrWallet(keplr, address, publicKey);
        else this.disconnect();
      }

      if (type === "leap" && window.leap) this.setKeplrWallet(window.leap, address, publicKey);
    });

    this.initWalletConnect()
      .then(async () => {
        this.options.unshift({
          download: "https://www.walletconnect.com/get",
          name: "WalletConnect",
          id: "walletconnect",
          type: "external",
          icon: WC_ICON,
        });

        const selected = await this.getStorage();
        if (selected.type !== "walletconnect") return;
        this.setupWalletConnect(selected.id as "keplr" | "leap");
      })
      .catch(() => {});
  }

  getClient(chain: string) {
    const rpc = chains.getByKey(chain)?.rpc || "";
    return StargateClient.connect({ url: rpc, headers: { "Api-Key": api.apiKey } });
  }

  get chains() {
    return chains.getByType(WalletType.COSMOS).map((t) => t.key);
  }

  async setupWalletConnect(id?: "keplr" | "leap" | "gonkaWallet"): Promise<CosmosWallet> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const properties = JSON.parse(wc.session?.sessionProperties?.keys || "{}");
    const account = properties?.find?.((t: any) => t.chainId === "gonka-mainnet");
    let publicKey = "";
    let address = "";

    if (account) {
      publicKey = Buffer.from(account.pubKey, "base64").toString("hex");
      address = account.bech32Address || "";
    } else {
      const savedAccount = await this.getStorage().catch(() => null);
      if (savedAccount?.address && savedAccount?.publicKey) {
        publicKey = savedAccount.publicKey;
        address = savedAccount.address;
      } else {
        const data = await this.requestWalletConnect({
          deeplink: id ? wallets[id].deeplink : undefined,
          icon: id ? wallets[id].icon : undefined,
          name: id ? wallets[id].name : undefined,
          request: {
            method: "cosmos_getAccounts",
            params: { chainId: "gonka-mainnet" },
          },
        });

        if (!Array.isArray(data) || data.length === 0) throw new Error("Account not found");
        publicKey = hex.encode(base64.decode(data[0].pubkey));
        address = data[0].address;
      }
    }

    this.setStorage({ type: "walletconnect", id, address, publicKey });
    const wallet = new CosmosWallet(this, {
      address: address,
      publicKeyHex: publicKey,
      disconnect: () => this.disconnectWalletConnect(),
      sendTransaction: async (signDoc: any) => {
        const { signed, signature } = await this.requestWalletConnect<{ signed: TxRaw; signature: { signature: string } }>({
          chain: `cosmos:${signDoc.chainId}`,
          deeplink: id ? wallets[id].deeplink : undefined,
          icon: id ? wallets[id].icon : undefined,
          name: id ? wallets[id].name : undefined,
          request: {
            method: "cosmos_signDirect",
            params: {
              signerAddress: address,
              signDoc: {
                chainId: signDoc.chainId,
                accountNumber: signDoc.accountNumber?.toString(),
                bodyBytes: signDoc.bodyBytes ? Buffer.from(signDoc.bodyBytes).toString("base64") : null,
                authInfoBytes: signDoc.authInfoBytes ? Buffer.from(signDoc.authInfoBytes).toString("base64") : null,
              },
            },
          },
        });

        const protobufTx = TxRaw.encode({
          bodyBytes: Object.keys(signed.bodyBytes).length > 0 ? signed.bodyBytes : signDoc.bodyBytes,
          authInfoBytes: Object.keys(signed.authInfoBytes).length > 0 ? signed.authInfoBytes : signDoc.authInfoBytes,
          signatures: [Buffer.from(signature.signature, "base64")],
        }).finish();

        const chain = chains.getByKey(signDoc.chainId);
        if (!chain) throw new Error("Chain not found");
        const client = await this.getClient(chain.key);

        const result = await client.broadcastTx(protobufTx);
        if (result.code !== 0) throw "Transaction failed";
        return result.transactionHash;
      },
    });

    return this.setWallet(wallet);
  }

  async setKeplrWallet(keplr: Keplr, address: string, publicKey: string) {
    return this.setWallet(
      new CosmosWallet(this, {
        address: address,
        publicKeyHex: publicKey,
        disconnect: () => keplr.disable(),
        sendTransaction: async (signDoc: any) => {
          await keplr.enable(this.chains);
          const rpcEndpoint = chains.getByKey(signDoc.chainId)?.rpc || "";
          return await signAndSendTx(keplr, rpcEndpoint, api.apiKey, signDoc);
        },
      })
    );
  }

  async connectGonkaWallet(): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    const result = await this.connectWalletConnect({
      onConnect: () => this.setupWalletConnect("gonkaWallet"),
      deeplink: wallets["gonkaWallet"].deeplink,
      namespaces: {
        cosmos: {
          methods: ["cosmos_getAccounts", "cosmos_signDirect"],
          events: ["chainChanged", "accountsChanged"],
          chains: this.chains.map((chain) => `cosmos:${chain}`),
          rpcMap: {},
        },
      },
    });

    window.parent.postMessage({ type: "wc_connect", payload: { wc: result.qrcode } }, "*");
    return result;
  }

  async connectKeplr(type: "keplr" | "leap" | "gonkaWallet", extension?: Keplr): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    if (!extension) {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(type),
        deeplink: wallets[type].deeplink,
        namespaces: {
          cosmos: {
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
            chains: this.chains.map((chain) => `cosmos:${chain}`),
            rpcMap: {},
          },
        },
      });
    }

    await extension.experimentalSuggestChain({
      bech32Config: { bech32PrefixAccAddr: "gonka", bech32PrefixAccPub: "gonka", bech32PrefixValAddr: "gonka", bech32PrefixValPub: "gonka", bech32PrefixConsAddr: "gonka", bech32PrefixConsPub: "gonka" },
      feeCurrencies: [{ coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka", gasPriceStep: { low: 0, average: 0, high: 0 } }],
      stakeCurrency: { coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka" },
      currencies: [{ coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka" }],
      rpc: "https://gonka04.6block.com:8443/chain-rpc",
      rest: "https://gonka04.6block.com:8443/chain-api",
      bip44: { coinType: 1200 },
      chainId: "gonka-mainnet",
      chainName: "Gonka",
    });

    await extension.enable(this.chains);
    const account = await extension.getKey("gonka-mainnet");
    await this.setStorage({ type, address: account.bech32Address, publicKey: hex.encode(account.pubKey) });
    return await this.setKeplrWallet(extension, account.bech32Address, hex.encode(account.pubKey));
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          cosmos: {
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
            chains: this.chains.map((chain) => `cosmos:${chain}`),
            rpcMap: {},
          },
        },
      });
    }

    if (id === "gonkaWallet") {
      return await this.connectGonkaWallet();
    }

    if (id === "keplr") {
      const keplr = await Keplr.getKeplr();
      return await this.connectKeplr("keplr", keplr);
    }

    if (id === "leap") {
      return await this.connectKeplr("leap", window.leap);
    }

    throw new Error("Wallet not found");
  }
}
