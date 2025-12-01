import { useState } from "react";
import { HotConnector, Intents, OmniWallet, omni } from "@hot-labs/wibe3";

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

  return (
    <div className="view">
      <p>Multichain Example</p>

      <button className={"input-button"} onClick={() => connector.connect()}>
        Open connector
      </button>

      <button className={"input-button"} onClick={() => connector.openBridge()}>
        Exchange
      </button>

      <button className={"input-button"} onClick={() => connector.deposit(omni.juno(), 1)}>
        Deposit 1 JUNO
      </button>

      <button className={"input-button"} onClick={() => connector.withdraw(omni.juno(), 1)}>
        Withdraw 1 JUNO
      </button>

      <button className={"input-button"} onClick={() => connector.payment(omni.usdt(), 1, "1lluzor.near")}>
        Pay 1 USDT
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
