import { makeObservable, observable, runInAction } from "mobx";
import { OneClickService } from "@defuse-protocol/one-click-sdk-typescript";

import { defaultTokens } from "./defaultTokens";
import { Network, OmniToken } from "./chains";
import { Token } from "./token";

class TokensStorage {
  public list = defaultTokens.flatMap((t: any) => [new Token(t), new Token({ ...t, omni: true })]);
  private initialTokensLoader = this.refreshTokens().catch(() => {});

  constructor() {
    makeObservable(this, {
      list: observable,
    });
  }

  get(id: OmniToken | string, chain = Network.Hot): Token {
    return this.list.find((t) => t.chain === chain && t.address === id)!;
  }

  async getToken(chain: number, address: string): Promise<Token> {
    const tokens = await this.getTokens();
    return tokens.find((t) => t.chain === chain && t.address === address)!;
  }

  async startTokenPolling() {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await this.refreshTokens().catch(() => {});
    await this.startTokenPolling();
  }

  async refreshTokens() {
    await this.initialTokensLoader;
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

    list.unshift({
      blockchain: "adi" as any,
      priceUpdatedAt: "2025-11-23T18:01:00.349Z",
      assetId: OmniToken.ADI,
      symbol: "ADI",
      decimals: 18,
      price: 0,
    });

    runInAction(() => {
      this.list = list.flatMap((t) => [new Token(t), new Token({ ...t, omni: true })]);
    });

    return this.list;
  }

  async getTokens(): Promise<Token[]> {
    await this.initialTokensLoader;
    return this.list;
  }
}

export const tokens = new TokensStorage();
