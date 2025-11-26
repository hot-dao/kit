import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";

import { HotConnector } from "../../HotConnector";
import { omni, BridgeReview } from "../../omni/exchange";
import { Token } from "../../omni/token";
import Popup from "../Popup";

import TokenCard from "./TokenCard";

interface PaymentProps {
  connector: HotConnector;
  token: Token;
  amount: bigint;
  receiver: string;
  onReject: (e: any) => void;
  onSuccess: (review: BridgeReview) => void | null;
}

const Payment = ({ connector, token, amount, receiver, onReject, onSuccess }: PaymentProps) => {
  const [selected, setSelected] = useState<Token | null>(null);
  const [qoute, setQoute] = useState<BridgeReview | null>(null);
  const [isQoute, setIsQoute] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (selected == null) return;
    const sender = connector.wallets.find((w) => w.type === selected.type);
    if (!sender) return;

    setIsQoute(false);
    omni
      .reviewSwap({ sender, from: selected, to: token, amount: (amount * 1005n) / 1000n, receiver: receiver, slippage: 0.005, type: "exactOut" })
      .then(setQoute)
      .catch((e) => console.error(e))
      .finally(() => setIsQoute(false));
  }, [selected]);

  const handlePay = () => {
    if (selected == null) return;
    const sender = connector.wallets.find((w) => w.type === selected.type);
    if (!sender) return;

    setIsPaying(true);
    omni
      .makeSwap(sender, qoute!, { log: (message) => console.log(message) })
      .then(onSuccess)
      .catch((e) => console.error(e))
      .finally(() => setIsPaying(false));
  };

  const need = token.usd * token.float(amount);
  const tokens = Object.values(connector.tokens).filter((t) => {
    const wallet = connector.wallets.find((w) => w.type === t.type);
    if (!wallet) return false;

    const balance = connector.balance(wallet, t);
    if (t.float(balance) * t.usd > need) return true;
    return false;
  });

  if (selected == null) {
    return (
      <Popup header={<p>Pay ${token.readable(amount, token.usd)}</p>} onClose={() => onReject(new Error("User rejected"))}>
        {tokens.map((token) => (
          <TokenCard key={token.id} token={token} onSelect={setSelected} hot={connector} wallet={connector.wallets.find((w) => w.type === token.type)!} />
        ))}
      </Popup>
    );
  }

  return (
    <Popup header={<p>Pay ${token.readable(amount, token.usd)}</p>} onClose={() => onReject(new Error("User rejected"))}>
      {qoute != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 4, width: "100%" }}>
            <img src={selected.icon} width={18} height={18} style={{ borderRadius: "50%" }} />
            <p style={{ marginRight: "auto" }}>{selected.symbol}</p>

            <p>
              {selected.readable(qoute.amountIn)} {selected.symbol} • ${selected.readable(qoute.amountIn, selected.usd)}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 4, width: "100%" }}>
            <img src={selected.chainIcon} width={18} height={18} style={{ borderRadius: "50%" }} />
            <p style={{ marginRight: "auto" }}>Network Fee</p>

            <p>
              {selected.readable(qoute.fee.gasPrice)} {selected.symbol} • ${selected.readable(qoute.fee.gasPrice, selected.usd)}
            </p>
          </div>
        </div>
      )}

      <button onClick={handlePay} disabled={isPaying || qoute == null}>
        {isPaying ? "Paying..." : qoute == null ? "Quoting..." : `Pay`}
      </button>
    </Popup>
  );
};

export default observer(Payment);
