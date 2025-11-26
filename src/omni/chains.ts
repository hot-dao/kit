import { Network } from "./config";

export interface ChainType {
  id: number;
  rpc: string[];
  api?: string[];
  submitter?: string[];
  icon: string;
  wrapToken: string;
  name: string;
  short: string;
  symbol: string;
  decimal: number;
  minimum?: number;
  isEvm: boolean;
  explorer?: string;
  explorerTx?: string;
  explorerToken?: string;
  explorerAcc?: string;
  isClosed?: boolean;
  isLayer2?: boolean;
  isTestnet?: boolean;
  isLayer3?: boolean;
  tokens?: string[];
  system?: boolean;
}

class ChainsManager {
  chains: ChainType[] = [];
  extraFee: Record<
    string,
    {
      gasPriceConstant?: number;
      gasPriceMultiplier?: number;
      baseFeeMultiplier?: number;
      priorityFeeMultiplier?: number;
      baseFeeConstant?: number;
      priorityFeeConstant?: number;
    }
  > = {};

  async loadChainsFromServer() {
    let cache: any = {};
    try {
      cache = JSON.parse(localStorage.getItem("chains") || "{}");
    } catch {}

    let isCompleted = false;
    const controller = new AbortController();
    setTimeout(() => !isCompleted && controller.abort(), 3000);
    const res = await fetch(`https://app.hot-labs.org/chains.json`, { signal: controller.signal });
    isCompleted = true;

    const data = await res.json();
    if (cache.version >= data.version) throw "No changes";
    localStorage.setItem("chains", JSON.stringify(data));
    await this.initializeChains();
  }

  readonly initializeTask = (async () => {
    await this.loadChainsFromServer().catch((error) => console.error(error));
    await this.initializeChains();
  })();

  async getChain(chain: number): Promise<ChainType> {
    await this.initializeTask;
    return this.get(chain);
  }

  async initializeChains() {
    const cache = JSON.parse(localStorage.getItem("chains") || "{}");
    const nonEvmChains: ChainType[] = cache.chains.filter((t: ChainType) => t.system);
    this.chains = [...nonEvmChains, ...cache.chains.filter((t: ChainType) => !nonEvmChains.some((non) => non.id === t.id))];
    this.extraFee = cache.extraFee || {};
  }

  isTon = (id?: number) => {
    return id === Network.OmniTon || id === Network.Ton;
  };

  get = (id: number): ChainType => {
    if (id === Network.OmniTon) id = Network.Ton;
    return (
      this.chains.find((t) => t.id === id) || {
        id: -1,
        rpc: [],
        icon: "",
        wrapToken: "",
        name: "",
        short: "",
        symbol: "",
        decimal: 0,
        minimum: 0,
        isEvm: false,
        explorer: "",
        explorerTx: "",
        explorerToken: "",
        system: false,
        submitter: [],
        api: [],
      }
    );
  };

  getEvmChains() {
    return this.chains.filter((t) => t.isEvm);
  }
}

export const Chains = new ChainsManager();
