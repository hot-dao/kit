import { useState } from "react";
import { HotConnector, Intents, OmniToken, OmniWallet } from "@hot-labs/wibe3";

export const MultichainExample = () => {
  const [wallets, setWallets] = useState<OmniWallet[]>([]);
  const [signedIntent, setSignedIntent] = useState<string>("");
  const [connector] = useState<HotConnector>(() => {
    const connector = new HotConnector({
      tonManifestUrl: "http://localhost:5173/hot-connector/tonconnect-manifest.json",
      projectId: "1292473190ce7eb75c9de67e15aaad99",
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

      <button className={"input-button"} onClick={() => connector.deposit(OmniToken.GONKA, 1)}>
        Deposit 1 GONKA
      </button>

      <button className={"input-button"} onClick={() => connector.withdraw(OmniToken.GONKA, 1)}>
        Withdraw 1 GONKA
      </button>

      <button className={"input-button"} onClick={() => connector.requestToken(OmniToken.USDT, 1)}>
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
              <button
                className={"input-button"}
                onClick={async () => {
                  try {
                    const signed = await wallet.intents.authCall({ contractId: "demo.tg", msg: "hello", attachNear: 0n, tgas: 50 }).sign();
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
                    const signed = await wallet.intents.give(OmniToken.USDC, -40).sign();
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
      {signedIntent && <pre style={{ marginTop: 20, padding: 10, overflow: "auto", maxWidth: 500 }}>{signedIntent}</pre>}
    </div>
  );
};
