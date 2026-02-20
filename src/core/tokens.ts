import { makeObservable, observable, runInAction, computed } from "mobx";
import { OneClickService } from "@defuse-protocol/one-click-sdk-typescript";

import { defaultTokens } from "./defaultTokens";
import { chains, Network, OmniToken } from "./chains";
import { Token } from "./token";

class TokensStorage {
  private initialTokensLoader: Promise<void> | null = null;
  private pollingStarted = false;
  public repository: Record<string, Token> = Object.fromEntries(
    defaultTokens.flatMap((t: any) => {
      const onchain = new Token(t);
      const omni = new Token({ ...t, omni: Network.Omni });
      const hotCraft = new Token({ ...t, omni: Network.HotCraft });
      return [
        [onchain.id, onchain],
        [omni.id, omni],
        [hotCraft.id, hotCraft],
      ];
    })
  );

  constructor() {
    makeObservable(this, {
      repository: observable,
      list: computed,
    });
  }

  get list() {
    return Object.values(this.repository);
  }

  get(id: OmniToken | string, chain = Network.Omni): Token {
    return this.list.find((t) => t.chain === chain && t.address === id)!;
  }

  async getToken(chain: number, address: string): Promise<Token> {
    const tokens = await this.getTokens();
    return tokens.find((t) => t.chain === chain && t.address === address)!;
  }

  ensurePolling() {
    if (this.pollingStarted) return;
    this.pollingStarted = true;
    this.ensureInitialLoad();
    this.startTokenPolling();
  }

  private ensureInitialLoad() {
    if (!this.initialTokensLoader) {
      this.initialTokensLoader = this.refreshTokens().then(() => {}).catch(() => {});
    }
    return this.initialTokensLoader;
  }

  async startTokenPolling(interval = 120_000) {
    await this.ensureInitialLoad();
    await new Promise((resolve) => setTimeout(resolve, interval));
    await this.refreshTokens().catch(() => {});
    await this.startTokenPolling();
  }

  async refreshTokens() {
    const list = await OneClickService.getTokens();

    list.unshift({
      blockchain: "gonka-mainnet" as any,
      priceUpdatedAt: "2025-11-23T18:01:00.349Z",
      assetId: OmniToken.GONKA,
      contractAddress: "ngonka",
      symbol: "GNK",
      decimals: 9,
      price: 0,
    });

    const stellarContractIds = new Map<string, string>();
    const stellarWithContract = list.filter((t) => chains.getByKey(t.blockchain)?.id === Network.Stellar && t.contractAddress);
    for (const t of stellarWithContract) {
      stellarContractIds.set(t.assetId, await Token.resolveStellarContractId(t.symbol, t.contractAddress!));
    }

    runInAction(() => {
      list.forEach((t) => {
        if (!chains.getByKey(t.blockchain)) return;
        const onchain = new Token(t);
        const omni = new Token({ ...t, omni: Network.Omni });
        const hotCraft = new Token({ ...t, omni: Network.HotCraft });

        const contractId = stellarContractIds.get(t.assetId);
        if (contractId) {
          onchain.address = contractId;
          onchain.originalAddress = contractId;
          omni.originalAddress = contractId;
          hotCraft.originalAddress = contractId;
        }

        if (this.repository[onchain.id]) this.repository[onchain.id].update(t);
        else this.repository[onchain.id] = onchain;

        if (this.repository[omni.id]) this.repository[omni.id].update(t);
        else this.repository[omni.id] = omni;

        if (this.repository[hotCraft.id]) this.repository[hotCraft.id].update(t);
        else this.repository[hotCraft.id] = hotCraft;
      });
    });

    return this.list;
  }

  async getTokens(): Promise<Token[]> {
    await this.ensureInitialLoad();
    return this.list;
  }
}

export const tokens = new TokensStorage();
