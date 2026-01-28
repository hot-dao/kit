import { runInAction } from "mobx";

import HOT from "../hot-wallet/iframe";
import type { HotConnector } from "../HotConnector";

import { Network, WalletType } from "../core/chains";
import { ConnectorType, OmniConnector, WC_ICON } from "../core/OmniConnector";
import EvmWallet, { EvmProvider } from "./wallet";

class EvmConnector extends OmniConnector<EvmWallet, { provider: EvmProvider }> {
  icon = "https://storage.herewallet.app/upload/06b43b164683c2cbfe9a9c0699f0953fd56f1f802035e7701ea10501d9e091c6.png";
  walletTypes = [WalletType.EVM, WalletType.OMNI];
  type = ConnectorType.WALLET;
  description = "Any Ethereum-like wallet";
  name = "EVM Wallet";
  id = "evm";

  constructor(wibe3: HotConnector) {
    super(wibe3);

    window.addEventListener<any>("eip6963:announceProvider", async (provider) => {
      if (this.options.find((t) => t.name === provider.detail.info.name || t.id === provider.detail.info.uuid)) return;

      runInAction(() => {
        const info = provider.detail.info;
        const wallet = {
          download: `https://${info.rdns.split(".").reverse().join(".")}`,
          provider: provider.detail.provider,
          type: "extension" as const,
          name: info.name,
          icon: info.icon,
          id: info.rdns,
        };

        if (info.rdns === "org.hot-labs") this.options.unshift(wallet);
        else this.options.push(wallet);
      });

      const connected = await this.getConnectedWallet();
      if (connected.type === "wallet" && connected.id === provider.detail.info.rdns) {
        this.connectWallet({
          id: provider.detail.info.rdns,
          provider: provider.detail.provider,
          isNew: false,
        });
      }
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));

    this.initWalletConnect()
      .then(() => {
        this.options.unshift({
          id: "walletconnect",
          name: "WalletConnect",
          provider: {} as any,
          type: "external",
          icon: WC_ICON,
        });
      })
      .catch(() => {});

    this.wc
      ?.then(async () => {
        const selected = await this.getConnectedWallet();
        if (selected.id !== "walletconnect") return;
        this.setupWalletConnect({ isNew: false });
      })
      .catch(() => {});
  }

  async setupWalletConnect({ isNew }: { isNew: boolean }): Promise<EvmWallet> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const address = wc.session?.namespaces.eip155.accounts[0]?.split(":")[2];
    if (!address) throw new Error("Account not found");

    this.setStorage({ type: "walletconnect" });

    const wallet = new EvmWallet(this, address, {
      request: async (request: any) => this.requestWalletConnect<any>({ request }),
    });

    return this.setWallet({ wallet, isNew });
  }

  async connectWallet({ id, provider, isNew }: { id: string; provider: EvmProvider; isNew: boolean }) {
    try {
      if (this.wallets.length > 0) this.removeWallet();
      const [address] = await provider.request({ method: "eth_requestAccounts" });
      if (!address) throw "No address found";
      this.setStorage({ type: "wallet", id });

      const handler = async (data: string[]) => {
        provider.off?.("accountsChanged", handler as any);
        if (data.length > 0) this.connectWallet({ id, provider, isNew });
        else this.disconnect();
      };

      provider.on?.("accountsChanged", handler);
      const wallet = new EvmWallet(this, address, provider);
      return this.setWallet({ wallet, isNew });
    } catch (e) {
      this.disconnect();
      throw e;
    }
  }

  async getConnectedWallet() {
    if (HOT.isInjected) return { type: "wallet", id: "org.hot-labs" };
    return await this.getStorage();
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect({ isNew: true }),
        namespaces: {
          eip155: {
            methods: ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
            chains: Object.values(Network).map((chain) => `eip155:${chain}`),
            events: ["chainChanged", "accountsChanged"],
            rpcMap: {},
          },
        },
      });
    }

    this.disconnectWalletConnect();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) throw new Error("Wallet not found");

    return await this.connectWallet({
      provider: wallet.provider,
      isNew: true,
      id,
    });
  }

  async disconnect() {
    this.wallets.forEach((w) => w.disconnect());
    super.disconnect();
  }
}

export default EvmConnector;
