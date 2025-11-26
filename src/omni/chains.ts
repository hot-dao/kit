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

export enum OmniToken {
  USDT = "nep141:usdt.tether-token.near",
  USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  JUNO = "nep245:v2_1.omni.hot.tg:4444118_EFL2FKC",
  GONKA = "nep245:v2_1.omni.hot.tg:4444119_wyixUKCL",
  NEAR = "nep141:wrap.near",
  ETH = "nep141:eth.bridge.near",
}

export enum Network {
  Omni_v1 = 0,
  Hot = -4,
  Zcash = -5,
  Btc = -6,

  Xrp = -7,
  Doge = -8,
  Ada = -9,
  Aptos = -10,
  Sui = -11,

  Juno = 4444118,
  Gonka = 4444119,
  OmniTon = 1117,

  Eth = 1,
  Tron = 333,
  Solana = 1001,
  Stellar = 1100,
  Near = 1010,
  Polygon = 137,
  Arbitrum = 42_161,
  Aurora = 1_313_161_554,
  Avalanche = 43_114,
  Linea = 59_144,
  Xlayer = 196,
  Base = 8453,
  Ton = 1111,
  Bnb = 56,
  OpBnb = 204,
  BnbTestnet = 97,
  Optimism = 10,
  Scroll = 534_352,
  EbiChain = 98_881,
  Sei = 1329,
  Blast = 81_457,
  Taiko = 167_000,
  Mantle = 5000,
  Manta = 169,
  Kava = 2222,
  ZkSync = 324,
  Monad = 10_143,
  Metis = 1088,
  Gnosis = 100,
  Fantom = 250,
  Cronos = 25,
  Chiliz = 88_888,
  Moonbeam = 1284,
  Ronin = 2020,
  Lisk = 1135,
  Sonic = 146,
  Zora = 7_777_777,
  Mode = 34_443,
  Berachain = 80_094,
  Unichain = 130,
  Soneium = 1868,
  Ink = 57_073,
  Apechain = 2741,
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
