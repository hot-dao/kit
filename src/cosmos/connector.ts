import { Keplr } from "@keplr-wallet/provider-extension";
import { StdSignature } from "@keplr-wallet/types";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import UniversalProvider from "@walletconnect/universal-provider";
import { StargateClient } from "@cosmjs/stargate";
import { base64, hex } from "@scure/base";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector, OmniConnectorOption, WC_ICON } from "../core/OmniConnector";
import { chains, WalletType } from "../core/chains";
import { OmniWallet } from "../core/OmniWallet";
import { api } from "../core/api";

import type { HotKit } from "../HotKit";
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

function getHotExtensionProvider(): Keplr | null {
  const ext = (window as any).hotExtension;
  if (!ext?.request) return null;

  const provider: any = {
    __isHotWallet: true,

    enable: async (chainIds: string | string[]) => {
      await ext.request("cosmos:enable", { chainIds: Array.isArray(chainIds) ? chainIds : [chainIds] });
    },

    disable: async () => {
      await ext.request("cosmos:disable", {});
    },

    getKey: async (chainId: string) => {
      const key = await ext.request("cosmos:getKey", { chainId });
      if (key.pubKey && typeof key.pubKey === "string") {
        key.pubKey = base64.decode(key.pubKey);
      } else if (key.pubKey && !(key.pubKey instanceof Uint8Array)) {
        key.pubKey = new Uint8Array(Object.values(key.pubKey));
      }

      return key;
    },

    signAmino: async (chainId: string, signer: string, signDoc: any) => {
      return await ext.request("cosmos:signAmino", { chainId, signer, signDoc });
    },

    signArbitrary: async (chainId: string, signer: string, data: string) => {
      return await ext.request("cosmos:signArbitrary", { chainId, signer, data });
    },

    experimentalSuggestChain: async (chainInfo: any) => {
      return await ext.request("cosmos:suggestChain", { chainInfo });
    },

    getOfflineSignerAuto: async (chainId: string) => ({
      getAccounts: async () => {
        const key = await provider.getKey(chainId);
        return [{ address: key.bech32Address, algo: "secp256k1" as const, pubkey: key.pubKey }];
      },
      signAmino: (addr: string, doc: any) => ext.request("cosmos:signAmino", { chainId, signer: addr, signDoc: doc }),
      signDirect: async (addr: string, doc: any) => {
        const s = { ...doc, bodyBytes: doc.bodyBytes ? Buffer.from(doc.bodyBytes).toString("base64") : null, authInfoBytes: doc.authInfoBytes ? Buffer.from(doc.authInfoBytes).toString("base64") : null };
        const result = await ext.request("cosmos:signDirect", { chainId, signer: addr, signDoc: s });
        if (result.signed) {
          if (typeof result.signed.bodyBytes === "string") result.signed.bodyBytes = base64.decode(result.signed.bodyBytes);
          if (typeof result.signed.authInfoBytes === "string") result.signed.authInfoBytes = base64.decode(result.signed.authInfoBytes);
        }
        return result;
      },
    }),
  };

  return provider as Keplr;
}

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.COSMOS];
  description = "Any Cosmos-like wallet";
  isSupported = true;
  id = "cosmos";

  constructor(kit: HotKit, readonly chainId = "gonka-mainnet") {
    super(kit);

    this.options = Object.values(wallets);

    Keplr.getKeplr().then((keplr) => {
      const isHotWallet = (keplr as any)?.__isHotWallet || (window as any).hotExtension;
      const isRealKeplr = keplr && !isHotWallet;

      const keplrOption = this.options.find((option) => option.id === "keplr")!;
      runInAction(() => {
        keplrOption.type = isRealKeplr ? "extension" : "external";
        keplrOption.name = isRealKeplr ? "Keplr Wallet" : "Keplr Mobile";

        if (isHotWallet && !this.options.find((o) => o.id === "hot-cosmos")) {
          this.options.unshift({
            name: "HOT Wallet",
            icon: "https://storage.herewallet.app/logo.png",
            type: "extension",
            id: "hot-cosmos",
          });
        }
      });
    });

    this.getStorage().then(async (data) => {
      if (!data[this.chainId]) return;

      if (data.type === "keplr") {
        const keplr = await Keplr.getKeplr();
        if (keplr) await this.createKeplrWallet({ wallet: keplr, account: data[this.chainId], isNew: false });
        else await this.disconnect();
      }

      if (data.type === "leap" && window.leap) {
        await this.createKeplrWallet({
          wallet: window.leap,
          account: data[this.chainId],
          isNew: false,
        });
      }

      if (data.type === "hot-cosmos") {
        const hotProvider = window.keplr || getHotExtensionProvider();
        if (hotProvider) {
          await this.createKeplrWallet({ wallet: hotProvider, account: data[this.chainId], isNew: false });
        } else {
          await this.disconnect();
        }
      }
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
        await this.createWalletConnect({ id: selected.id as "keplr" | "leap", isNew: false });
      })
      .catch(() => {});
  }

  get icon() {
    return chains.getByKey(this.chainId)?.logo || "";
  }

  get name() {
    return (chains.getByKey(this.chainId)?.name || "Cosmos") + " Wallet";
  }

  getClient(chain: string) {
    const rpc = chains.getByKey(chain)?.rpc || "";
    return StargateClient.connect({ url: rpc, headers: { "Api-Key": api.apiKey } });
  }

  get chains() {
    return chains.getByType(WalletType.COSMOS).map((t) => t.key);
  }

  async getAccountFromWalletConnect(wc: UniversalProvider, chainId: string, id?: "keplr" | "leap" | "gonkaWallet") {
    const properties = JSON.parse(wc.session?.sessionProperties?.keys || "{}");
    const account = properties?.find?.((t: any) => t.chainId === chainId);

    if (account) {
      const publicKey = Buffer.from(account.pubKey, "base64").toString("hex");
      const address = account.bech32Address || "";
      return { publicKey, address };
    }

    const savedAccount = await this.getStorage().catch(() => null);
    if (savedAccount?.[chainId]) return savedAccount[chainId];

    const data = await this.requestWalletConnect({
      deeplink: id ? wallets[id].deeplink : undefined,
      icon: id ? wallets[id].icon : undefined,
      name: id ? wallets[id].name : undefined,
      request: {
        method: "cosmos_getAccounts",
        params: { chainId },
      },
    });

    if (!Array.isArray(data) || data.length === 0) throw new Error("Account not found");
    return { publicKey: hex.encode(base64.decode(data[0].pubkey)), address: data[0].address };
  }

  async createWalletConnect({ id, isNew }: { id?: "keplr" | "leap" | "gonkaWallet"; isNew: boolean }): Promise<CosmosWallet> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const chain = chains.getByKey(this.chainId);
    if (!chain) throw new Error("Chain not found");

    const chainAccount = await this.getAccountFromWalletConnect(wc, this.chainId, id);
    if (!chainAccount.address?.includes(chain.prefix)) {
      throw `${id ? wallets[id]?.name : "This wallet"} does not support ${chain?.name} chain, add it manually or use another wallet`;
    }

    const cosmosAccount = await this.getAccountFromWalletConnect(wc, "cosmoshub-4", id).catch((e) => {
      this.setStorage({ type: "walletconnect", id, [this.chainId]: chainAccount });
      throw e;
    });

    await this.setStorage({ [this.chainId]: chainAccount, "cosmoshub-4": cosmosAccount, type: "walletconnect", id });
    const wallet = new CosmosWallet({
      chainId: this.chainId,
      account: chainAccount,
      cosmos: cosmosAccount,
      disableOmni: true,

      disconnect: () => this.disconnectWalletConnect(),
      signAmino: async (chainId: string, address: string, signDoc: any) => {
        return await this.requestWalletConnect<{ signature: StdSignature }>({
          request: {
            method: "cosmos_signAmino",
            params: { signerAddress: address, signDoc },
          },
        });
      },

      sendTransaction: async (signDoc: any) => {
        const { signed, signature } = await this.requestWalletConnect<{ signed: TxRaw; signature: { signature: string } }>({
          chain: `cosmos:${signDoc.chainId}`,
          deeplink: id ? wallets[id].deeplink : undefined,
          icon: id ? wallets[id].icon : undefined,
          name: id ? wallets[id].name : undefined,
          request: {
            method: "cosmos_signDirect",
            params: {
              signerAddress: chainAccount.address,
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

    return this.setWallet({ wallet, isNew });
  }

  async createKeplrWallet({ wallet, account, isNew }: { wallet: Keplr; account: { address: string; publicKey: string }; isNew: boolean }) {
    const cosmosAccount = await wallet.getKey("cosmoshub-4");
    const instance = new CosmosWallet({
      account,
      cosmos: { address: cosmosAccount.bech32Address, publicKey: hex.encode(cosmosAccount.pubKey) },
      chainId: this.chainId,
      disableOmni: true,

      disconnect: () => wallet.disable(),

      signMessage: async (chainId: string, address: string, message: string) => {
        return await wallet.signArbitrary(chainId, address, message);
      },

      sendTransaction: async (signDoc: any) => {
        await wallet.enable(this.chains);
        const rpcEndpoint = chains.getByKey(signDoc.chainId)?.rpc || "";
        return await signAndSendTx(wallet, rpcEndpoint, api.apiKey, signDoc);
      },

      signAmino: async (chainId: string, address: string, signDoc: any) => {
        return await wallet.signAmino(chainId, address, signDoc);
      },
    });

    return this.setWallet({ wallet: instance, isNew });
  }

  async connectGonkaWallet(): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    const result = await this.connectWalletConnect({
      onConnect: async () => await this.createWalletConnect({ id: "gonkaWallet", isNew: true }),
      deeplink: wallets["gonkaWallet"].deeplink,
      namespaces: {
        cosmos: {
          chains: [...new Set([`cosmos:${this.chainId}`, "cosmos:cosmoshub-4"])],
          methods: ["cosmos_getAccounts", "cosmos_signDirect"],
          events: ["chainChanged", "accountsChanged"],
          rpcMap: {},
        },
      },
    });

    window.parent.postMessage({ type: "wc_connect", payload: { wc: result.qrcode } }, "*");
    return result;
  }

  async connectKeplr(type: "keplr" | "leap" | "gonkaWallet" | "hot-cosmos", extension?: Keplr): Promise<OmniWallet | { qrcode: string; deeplink?: string; task: Promise<OmniWallet> }> {
    if (!extension) {
      return await this.connectWalletConnect({
        onConnect: async () => await this.createWalletConnect({ id: type as "keplr" | "leap" | "gonkaWallet", isNew: true }),
        deeplink: wallets[type]?.deeplink,
        namespaces: {
          cosmos: {
            chains: [...new Set([`cosmos:${this.chainId}`, "cosmos:cosmoshub-4"])],
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
            rpcMap: {},
          },
        },
      });
    }

    if (this.chainId === "gonka-mainnet") {
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
    }

    await extension.enable(this.chains);
    const account = await extension.getKey(this.chainId);
    const cosmosAccount = await extension.getKey("cosmoshub-4");
    const chainAccount = { address: account.bech32Address, publicKey: hex.encode(account.pubKey) };
    const cosmosAccountData = { address: cosmosAccount.bech32Address, publicKey: hex.encode(cosmosAccount.pubKey) };
    await this.setStorage({ type, [this.chainId]: chainAccount, "cosmoshub-4": cosmosAccountData });
    return await this.createKeplrWallet({ wallet: extension, account: chainAccount, isNew: true });
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: async () => await this.createWalletConnect({ isNew: true }),
        namespaces: {
          cosmos: {
            chains: [...new Set([`cosmos:${this.chainId}`, "cosmos:cosmoshub-4"])],
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
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

    if (id === "hot-cosmos") {
      const hotProvider = window.keplr || getHotExtensionProvider();
      if (!hotProvider) throw new Error("HOT Wallet not found");
      return await this.connectKeplr("hot-cosmos", hotProvider);
    }

    throw new Error("Wallet not found");
  }
}
