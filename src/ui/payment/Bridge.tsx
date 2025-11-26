import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";

import { OmniWallet } from "../../omni/OmniWallet";
import { formatter, Token } from "../../omni/token";
import { BridgeReview, omni } from "../../omni";
import { HotConnector } from "../../HotConnector";

import Popup from "../Popup";
import { openSelectTokenPopup, openSelectWallet } from "../router";
import { TokenIcon } from "./TokenCard";

export interface BridgeProps {
  hot: HotConnector;
  onClose: () => void;
  setup?: {
    sender: OmniWallet;
    receipient: OmniWallet;
    amount: number;
    from: Token;
    to: Token;
  };
}

const Bridge = ({ hot, setup, onClose }: BridgeProps) => {
  const [isFiat, setIsFiat] = useState(false);
  const [value, setValue] = useState<string>(setup?.amount.toString() ?? "");
  const [from, setFrom] = useState<Token>(setup?.from || hot.tokens[0]);
  const [to, setTo] = useState<Token>(setup?.to || hot.tokens[1]);

  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<BridgeReview | null>(null);

  const [sender, setSender] = useState<OmniWallet | undefined>(setup?.sender || hot.wallets.find((w) => w.type === from.type));
  const [receipient, setReceipient] = useState<OmniWallet | undefined>(setup?.receipient || hot.wallets.find((w) => w.type === to.type));
  const fromAmount = formatter.fromInput(value);

  useEffect(() => {
    let isInvalid = false;
    let debounceTimer: NodeJS.Timeout;
    if (+fromAmount <= 0) return;
    if (sender == null) return;
    if (receipient == null) return;

    setIsReviewing(true);
    debounceTimer = setTimeout(async () => {
      try {
        if (isInvalid) return;
        const amount = from.int(isFiat ? +fromAmount / from.usd : fromAmount);
        const review = await omni.reviewSwap({ sender, amount, receiver: receipient.address, slippage: 0.005, type: "exactIn", from, to });
        if (isInvalid) return;
        setIsError(null);
        setReview(review);
      } catch (e) {
        if (isInvalid) return;
        setIsError("Failed to review swap");
        console.error(e);
      } finally {
        if (isInvalid) return;
        setIsReviewing(false);
      }
    }, 500);

    return () => {
      isInvalid = true;
      clearTimeout(debounceTimer);
    };
  }, [fromAmount, from, to, isFiat, sender, receipient]);

  const handleConfirm = async () => {
    try {
      if (review == null) return;
      setIsProcessing(true);
      const result = await omni.makeSwap(sender!, review, { log: setProcessingMessage });
      setProcessingResult(result);
      setIsProcessing(false);
    } catch (e) {
      setIsProcessing(false);
      console.error(e);
    }
  };

  if (isProcessing) {
    return (
      <Popup onClose={onClose}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <p>{processingMessage || "Signing transaction"}</p>
        </div>
      </Popup>
    );
  }

  if (processingResult != null) {
    return (
      <Popup onClose={onClose}>
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <p>Swap successful</p>
        </div>
      </Popup>
    );
  }

  const button = () => {
    if (sender == null) return <button disabled>Set sender</button>;
    if (receipient == null) return <button disabled>Set recipient</button>;
    if (from.float(hot.balance(sender, from)) < +fromAmount) return <button disabled>Insufficient balance</button>;
    return (
      <button disabled={isReviewing || isError != null} onClick={handleConfirm}>
        {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
      </button>
    );
  };

  return (
    <Popup onClose={onClose}>
      <style>{styles}</style>

      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>From</p>
              <div className="small-button" onClick={() => openSelectWallet(hot, false, from.type, (wallet) => setSender(wallet))}>
                <p>{formatter.truncateAddress(sender?.address ?? "Connect wallet")}</p>
              </div>
            </div>

            <div className="small-button" onClick={() => setIsFiat(!isFiat)}>
              USD
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview token={from} onSelect={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setFrom(token), setSender(wallet)) })} />
            <input className="input" value={isFiat ? `$${fromAmount}` : fromAmount} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {isFiat ? (
              <p>Available: ${from.readable(hot.balance(sender, from), from.usd)}</p>
            ) : (
              <p>
                Available: {from.readable(hot.balance(sender, from))} {from.symbol}
              </p>
            )}

            {isFiat ? (
              <p>
                {from.readable(+fromAmount / from.usd)} {from.symbol}
              </p>
            ) : (
              <p>${from.readable(+fromAmount, from.usd)}</p>
            )}
          </div>
        </div>

        <div style={{ width: "100%", height: 1, backgroundColor: "#2d2d2d", marginTop: 16, marginBottom: 16 }} />

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>To</p>
              <div className="small-button" onClick={() => openSelectWallet(hot, true, to.type, (wallet) => setReceipient(wallet))}>
                <p>{formatter.truncateAddress(receipient?.address ?? "Connect wallet")}</p>
              </div>
            </div>
            <p>${to.readable(review?.amountOut ?? 0, to.usd)}</p>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview token={to} onSelect={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setTo(token), setReceipient(wallet)) })} />
            <h2 style={{ fontSize: 32, lineHeight: "40px", fontWeight: "bold" }}>{to.readable(review?.amountOut ?? 0)}</h2>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>{button()}</div>
      </div>
    </Popup>
  );
};

const TokenPreview = ({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, cursor: "pointer" }} onClick={() => onSelect(token)}>
      <TokenIcon token={token} />
      <p style={{ fontSize: 24, fontWeight: "bold" }}>{token.symbol}</p>
    </div>
  );
};

const styles = /* css */ `
.card {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    border-radius: 12px;
}

.card .input {
    outline: none;
    border: none;
    background: none;
    color: #fff;
    font-size: 32px;
    font-weight: bold;
    width: 100%;
    line-height: 40px;
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    background: transparent;
    text-align: right;
    border: none;
    padding: 0;
    margin: 0;
}

.small-button {
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    background: #282c30;
    padding: 4px 8px;
    border-radius: 16px;
    cursor: pointer;
}
`;

export default observer(Bridge);
