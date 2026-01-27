import { makeObservable, observable, runInAction, computed } from "mobx";
import { OneClickService } from "@defuse-protocol/one-click-sdk-typescript";

import { defaultTokens } from "./defaultTokens";
import { chains, Network, OmniToken } from "./chains";
import { Token } from "./token";

class TokensStorage {
  private initialTokensLoader = this.refreshTokens().catch(() => {});
  public repository: Record<string, Token> = Object.fromEntries(
    defaultTokens.flatMap((t: any) => {
      const onchain = new Token(t);
      const omni = new Token({ ...t, omni: true });
      return [
        [onchain.id, onchain],
        [omni.id, omni],
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

  async startTokenPolling(interval = 120_000) {
    await this.initialTokensLoader;
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

    runInAction(() => {
      list.forEach((t) => {
        if (!chains.getByKey(t.blockchain)) return;
        const onchain = new Token(t);
        const omni = new Token({ ...t, omni: true });

        if (this.repository[onchain.id]) this.repository[onchain.id].update(t);
        else this.repository[onchain.id] = onchain;

        if (this.repository[omni.id]) this.repository[omni.id].update(t);
        else this.repository[omni.id] = omni;
      });
    });

    return this.list;
  }

  async getTokens(): Promise<Token[]> {
    await this.initialTokensLoader;
    return this.list;
  }
}

export const tokens = new TokensStorage();
