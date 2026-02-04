import { useState } from "react";
import { HotKit, OmniToken } from "@hot-labs/kit";
import { defaultConnectors } from "@hot-labs/kit/defaults";
import cosmos from "@hot-labs/kit/cosmos";

import { observer } from "mobx-react-lite";

const kit = new HotKit({
  apiKey: "",
  connectors: [...defaultConnectors, cosmos()],
  walletConnect: {
    projectId: "1292473190ce7eb75c9de67e15aaad99",
    metadata: {
      name: "Example App",
      description: "Example App",
      url: window.location.origin,
      icons: ["/favicon.ico"],
    },
  },
});

export const MultichainExample = observer(() => {
  const [signedIntent, setSignedIntent] = useState<string>("");

  const handlePay = async () => {
    await kit
      .intentsBuilder()
      .transfer({
        amount: 0.1,
        token: OmniToken.USDC,
        recipient: "pay.fi.tg",
        msg: JSON.stringify({
          merchant_id: "1lluzor.near",
          item_id: "f2122846a0ee5e229f166da95b720ead437d10291811d1754ca8dcc657ea8856",
          memo: "custom_memo",
        }),
      })
      .depositAndExecute({ payload: { email: "test@test.com" } });
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      <div className="view">
        <p>Multichain Example</p>

        <button className={"input-button"} onClick={() => kit.connect()}>
          Open connector
        </button>

        <button className={"input-button"} onClick={() => kit.openBridge()}>
          Exchange
        </button>

        <button className={"input-button"} onClick={() => kit.deposit(OmniToken.GONKA, 1)}>
          Deposit 1 GONKA
        </button>

        <button className={"input-button"} onClick={() => kit.withdraw(OmniToken.GONKA, 1)}>
          Withdraw 1 GONKA
        </button>

        <button className={"input-button"} onClick={handlePay}>
          Pay 1 USDT
        </button>
      </div>

      {kit.wallets.map(
        (wallet) =>
          wallet != null && (
            <div key={wallet.type} style={{ width: 300, overflow: "hidden" }} className="view">
              <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{wallet.address}</p>
              <button
                className={"input-button"}
                onClick={async () => {
                  const jwt = await wallet.auth();
                  alert(jwt);
                }}
              >
                Sign auth intents
              </button>

              <button
                className={"input-button"}
                onClick={async () => {
                  try {
                    const signed = await kit.intentsBuilder(wallet).authCall({ contractId: "demo.tg", msg: "hello", attachNear: 0n, tgas: 50 }).sign();
                    setSignedIntent(JSON.stringify(signed, null, 2));
                  } catch (e) {
                    console.error(e);
                    alert("Something wrong, check DevTools");
                  }
                }}
              >
                Sign auth_call
              </button>

              <button
                className={"input-button"}
                onClick={async () => {
                  try {
                    const signed = await kit.intentsBuilder(wallet).give(OmniToken.USDC, -40).sign();
                    setSignedIntent(JSON.stringify(signed, null, 2));
                  } catch (e) {
                    console.error(e);
                    alert("Something wrong, check DevTools");
                  }
                }}
              >
                Sign token_diff
              </button>
            </div>
          )
      )}

      {signedIntent && (
        <div className="view">
          <p>Signed Intent</p>
          <pre style={{ marginTop: 20, padding: 10, overflow: "auto", maxWidth: 500, textAlign: "left" }}>{signedIntent}</pre>
        </div>
      )}
    </div>
  );
});
