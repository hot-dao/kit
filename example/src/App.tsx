import { useEffect, useState } from "react";
import { HotConnector, Intents, OmniWallet, OmniToken, omni } from "../../src";
import uuid4 from "uuid4";
import { rpc } from "../../src/near/rpc";

export const MultichainExample = () => {
  const [wallets, setWallets] = useState<OmniWallet[]>([]);
  const [connector] = useState<HotConnector>(() => {
    const connector = new HotConnector({
      projectId: "1292473190ce7eb75c9de67e15aaad99",
      tonWalletsUrl: "http://localhost:1241/hot-connector/tonconnect-manifest.json",
      metadata: {
        name: "Example App",
        description: "Example App",
        url: window.location.origin,
        icons: ["/favicon.ico"],
      },
    });

    connector.onConnect(() => setWallets([...connector.wallets]));
    connector.onDisconnect(() => setWallets([...connector.wallets]));
    return connector;
  });

  useEffect(() => {
    rpc
      .viewMethod({ contractId: "escrow.fi.tg", methodName: "escrow_view_all", args: { offset: 0, limit: 10 } })
      .then((data) => {
        console.log(data);
      })
      .catch((error) => {
        console.log("error", error);
      });
  }, []);

  const deposit = async () => {
    if (!connector.near) return;
    connector.near.intents
      .withdraw({
        amount: 1,
        token: OmniToken.JUNO,
        receiver: "escrow.fi.tg",
        msg: JSON.stringify({
          action: "Fund",
          params: {
            price: String(10n ** 12n),
            src_token: OmniToken.JUNO,
            dst_token: OmniToken.USDT,
            decimal_from: omni.omni(OmniToken.JUNO).decimals,
            decimal_to: omni.omni(OmniToken.USDT).decimals,
            refund_src_to: { receiver_id: "intents.near", memo: "null", msg: connector.near.omniAddress, min_gas: 50000000000000 },
            receive_dst_to: { receiver_id: "intents.near", memo: "null", msg: connector.near.omniAddress, min_gas: 50000000000000 },
            receive_src_to: { receiver_id: "intents.near", memo: "null", msg: connector.near.omniAddress, min_gas: 50000000000000 },
            protocol_fees: { fee: 10000, collector: "intents.tg" },
            maker: connector.near.omniAddress,
            deadline: 1835689599000000000,
            partial_fills_allowed: true,
            taker_whitelist: [],
            auth_caller: null,
            salt: uuid4(),
          },
        }),
      })
      .execute();
  };

  const fill = async () => {
    if (!connector.near) return;
    connector.near.intents
      .withdraw({
        amount: 0.1,
        token: OmniToken.USDT,
        receiver: "escrow.fi.tg",
        msg: JSON.stringify({
          action: "Fill",
          params: {
            deadline: 1835689599000000000,
            decimal_from: 6,
            decimal_to: 6,
            dst_token: "nep141:usdt.tether-token.near",
            maker: "here_pasha-hot4.tg",
            partial_fills_allowed: true,
            price: "1000000000000",
            protocol_fees: { collector: "intents.tg", fee: 10000 },
            receive_dst_to: { memo: "null", min_gas: 50000000000000, msg: "here_pasha-hot4.tg", receiver_id: "intents.near" },
            receive_src_to: { memo: "null", min_gas: 50000000000000, msg: "here_pasha-hot4.tg", receiver_id: "intents.near" },
            refund_src_to: { memo: "null", min_gas: 50000000000000, msg: "here_pasha-hot4.tg", receiver_id: "intents.near" },
            salt: "77e34350-6c4d-472b-bf23-9648073b1d43",
            src_token: "nep245:v2_1.omni.hot.tg:4444118_EFL2FKC",
          },
        }),
      })
      .execute();
  };

  return (
    <div className="view">
      <p>Multichain Example</p>

      <button className={"input-button"} onClick={() => connector.connect()}>
        Open connector
      </button>

      <button className={"input-button"} onClick={() => connector.openBridge()}>
        Exchange
      </button>

      <button className={"input-button"} onClick={() => connector.deposit(OmniToken.JUNO, 1)}>
        Deposit 1 JUNO
      </button>

      <button className={"input-button"} onClick={() => connector.withdraw(OmniToken.JUNO, 1)}>
        Withdraw 1 JUNO
      </button>

      <button className={"input-button"} onClick={() => connector.payment(OmniToken.USDT, 1, "1lluzor.near")}>
        Pay 1 USDT
      </button>

      <button className={"input-button"} onClick={() => deposit()}>
        Deposit Juno to Escrow
      </button>

      <button className={"input-button"} onClick={() => fill()}>
        Fill Escrow
      </button>

      {wallets.map(
        (wallet) =>
          wallet != null && (
            <div key={wallet.type} style={{ width: 200 }}>
              <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wallet.address}</p>
              <button
                className={"input-button"}
                onClick={async () => {
                  try {
                    const { signed } = await wallet.auth("auth", [], async (t) => t);
                    const result = await Intents.simulateIntents([signed]);
                    console.log(result);
                    alert("Verified!");
                  } catch (e) {
                    console.error(e);
                    alert("Something wrong, check DevTools");
                  }
                }}
              >
                Sign auth intents
              </button>
            </div>
          )
      )}
    </div>
  );
};
