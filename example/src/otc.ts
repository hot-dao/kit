import uuid4 from "uuid4";
import { makeObservable, observable, runInAction } from "mobx";

import { formatter } from "../../src/omni/token";
import { omni, OmniToken, OmniWallet } from "../../src";
import { wibe3 } from "./wibe3";

export interface OrderType {
  closed: boolean;
  deadline: number;
  in_flight: number;
  maker_src_remaining: string;
  params: {
    deadline: number;
    decimal_from: number;
    decimal_to: number;
    dst_token: OmniToken;
    src_token: OmniToken;
    maker: string;
    partial_fills_allowed: true;
    price: string;
    protocol_fees: { collector: string; fee: number };
    receive_dst_to: { memo: string; min_gas: number; msg: string; receiver_id: string };
    receive_src_to: { memo: string; min_gas: number; msg: string; receiver_id: string };
    refund_src_to: { memo: string; min_gas: number; msg: string; receiver_id: string };
    salt: string;
  };
}

class Otc {
  orders: { ask: OrderType[]; bid: OrderType[] } = { ask: [], bid: [] };

  constructor() {
    makeObservable(this, { orders: observable });
    this.fetchOrders();
  }

  async fund(wallet: OmniWallet, from: OmniToken, to: OmniToken, amount: number, price: number) {
    await wallet.intents
      .withdraw({
        amount: amount,
        token: from,
        receiver: "escrow.fi.tg",
        msg: JSON.stringify({
          action: "Fund",
          params: {
            price: formatter.parseAmount(price, 12),
            src_token: from,
            dst_token: to,
            decimal_from: omni.omni(from).decimals,
            decimal_to: omni.omni(to).decimals,
            refund_src_to: { receiver_id: "intents.near", memo: "null", msg: wallet.omniAddress, min_gas: 50000000000000 },
            receive_dst_to: { receiver_id: "intents.near", memo: "null", msg: wallet.omniAddress, min_gas: 50000000000000 },
            receive_src_to: { receiver_id: "intents.near", memo: "null", msg: wallet.omniAddress, min_gas: 50000000000000 },
            protocol_fees: { fee: 10000, collector: "intents.tg" },
            maker: wallet.omniAddress,
            deadline: 1835689599000000000,
            partial_fills_allowed: true,
            taker_whitelist: [],
            auth_caller: null,
            salt: uuid4(),
          },
        }),
      })
      .execute({ connector: wibe3 });

    await this.fetchOrders();
  }

  async fill(wallet: OmniWallet, amount: number, params: OrderType["params"]) {
    return await wallet.intents
      .withdraw({
        token: params.dst_token,
        receiver: "escrow.fi.tg",
        msg: JSON.stringify(params),
        amount: amount,
      })
      .execute({ connector: wibe3 });
  }

  async fetchOrders() {
    const res = await fetch("https://dev.herewallet.app/api/v1/exchange/limit_orders/gonka", {
      headers: { Authorization: "debug-f8y3f-93f0:kostih34.tg" },
      method: "GET",
    });

    const { orders } = await res.json();
    runInAction(() => {
      this.orders.ask = orders.ask;
      this.orders.bid = orders.bid;
    });
  }
}

export default new Otc();
