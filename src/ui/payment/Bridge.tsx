import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { observer } from "mobx-react-lite";
import uuid4 from "uuid4";

import { SwitchIcon } from "../icons/switch";
import { ArrowRightIcon } from "../icons/arrow-right";

import { formatter } from "../../core/utils";
import { tokens } from "../../core/tokens";
import { Recipient } from "../../core/recipient";
import { OmniWallet } from "../../OmniWallet";
import { BridgeReview } from "../../exchange";
import { HotConnector } from "../../HotConnector";
import { WalletType } from "../../core/chains";
import { Token } from "../../core/token";

import Popup from "../Popup";
import { PopupButton } from "../styles";
import { openSelectRecipient, openSelectTokenPopup, openSelectSender } from "../router";
import { TokenIcon } from "./TokenCard";
import DepositQR from "./DepositQR";

export interface BridgeProps {
  hot: HotConnector;
  widget?: boolean;
  onClose: () => void;
  onProcess: (task: Promise<BridgeReview>) => void;
  setup?: {
    mobileFullscreen?: boolean;
    autoClose?: boolean; // if true, the popup will close automatically when the transaction is successful
    title?: string;
    readonlyAmount?: boolean;
    readonlyTo?: boolean;
    readonlyFrom?: boolean;
    type?: "exactIn" | "exactOut";
    sender?: OmniWallet;
    recipient?: Recipient;
    amount?: number;
    from?: Token;
    to?: Token;
  };
}

const FIXED = 6;

export const Bridge = observer(({ hot, widget, setup, onClose, onProcess }: BridgeProps) => {
  const [isFiat, setIsFiat] = useState(false);
  const [type, setType] = useState<"exactIn" | "exactOut">(setup?.type || "exactIn");
  const [value, setValue] = useState<string>(setup?.amount?.toString() ?? "");
  const [from, setFrom] = useState<Token>(setup?.from || tokens.list.find((t) => t.id === localStorage.getItem("bridge:from")) || tokens.list.find((t) => t.symbol === "NEAR")!);
  const [to, setTo] = useState<Token>(setup?.to || tokens.list.find((t) => t.id === localStorage.getItem("bridge:to")) || tokens.list.find((t) => t.symbol === "USDT")!);

  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const [processing, setProcessing] = useState<{
    status: "qr" | "processing" | "success" | "error";
    resolve?: (value: BridgeReview) => void;
    reject?: (error: Error) => void;
    message: string;
    review: BridgeReview;
  } | null>(null);

  const [sender, setSender] = useState<OmniWallet | "qr" | undefined>(() => {
    if (setup?.sender) return setup.sender;
    if (from.type === WalletType.OMNI) return hot.priorityWallet;
    return hot.wallets.find((w) => w.type === from.type);
  });

  const [recipient, setRecipient] = useState<Recipient | undefined>(() => {
    if (setup?.recipient) return setup.recipient;
    if (to.type === WalletType.OMNI) return Recipient.fromWallet(hot.priorityWallet!);
    return Recipient.fromWallet(hot.wallets.find((w) => w.type === to.type)!);
  });

  const initialSender = useRef<OmniWallet | "qr" | undefined>(sender);
  const initialRecipient = useRef<Recipient | undefined>(recipient);

  const valueInTokens = isFiat ? +formatter.fromInput(value) / (type === "exactIn" ? from.usd : to.usd) : +formatter.fromInput(value);
  const amountFrom = type === "exactOut" ? from.float(review?.amountIn ?? 0) : valueInTokens;
  const amountTo = type === "exactIn" ? to.float(review?.amountOut ?? 0) : valueInTokens;

  const showAmountFrom = type === "exactOut" ? +from.float(review?.amountIn ?? 0).toFixed(FIXED) : formatter.fromInput(value);
  const showAmountTo = type === "exactIn" ? +to.float(review?.amountOut ?? 0).toFixed(FIXED) : formatter.fromInput(value);

  const availableBalance = sender !== "qr" ? +Math.max(0, from.float(hot.balance(sender, from)) - from.reserve).toFixed(FIXED) : 0;

  let title = "Exchange";
  if (from.chain === -4) title = `Withdraw ${from.symbol}`;
  if (to.chain === -4) title = `Deposit ${to.symbol}`;
  if (to.chain === from.chain) title = "Exchange";

  useEffect(() => {
    localStorage.setItem("bridge:from", from.id);
    localStorage.setItem("bridge:to", to.id);
  }, [from, to]);

  useEffect(() => {
    if (initialSender.current == null) {
      if (from.type === WalletType.OMNI) setSender(hot.priorityWallet);
      else setSender(hot.wallets.find((w) => w.type === from.type));
    }

    if (initialRecipient.current == null) {
      if (to.type === WalletType.OMNI) setRecipient(Recipient.fromWallet(hot.priorityWallet));
      else setRecipient(Recipient.fromWallet(hot.wallets.find((w) => w.type === to.type)));
    }
  }, [to, from, hot.wallets, hot.priorityWallet]);

  const reviewId = useRef(uuid4());
  const throwError = (message: string) => {
    setIsError(message);
    setIsReviewing(false);
  };

  const reviewSwap = useCallback(() => {
    reviewId.current = uuid4();
    const currentReviewId = reviewId.current;
    setIsReviewing(true);
    setReview(null);
    setIsError(null);

    const refund = sender !== "qr" ? sender : hot.priorityWallet;
    if (valueInTokens <= 0) return throwError("Enter amount");
    if (!sender) return throwError("Set sender");
    if (!recipient) return throwError("Set recipient");
    if (!refund) return throwError("Connect any wallet");

    const debounceTimer = setTimeout(async () => {
      try {
        if (currentReviewId !== reviewId.current) return;
        const amount = type === "exactIn" ? from.int(valueInTokens) : to.int(valueInTokens);
        const review = await hot.exchange.reviewSwap({ sender, refund, amount, recipient, slippage: 0.005, type, from, to });
        if (currentReviewId !== reviewId.current) return;
        setIsReviewing(false);
        setIsError(null);
        setReview(review);
      } catch (e) {
        if (currentReviewId !== reviewId.current) return;
        setIsError(typeof e === "string" ? e : e instanceof Error ? e.message : "Failed to review swap");
        setIsReviewing(false);
        setReview(null);
        console.error(e);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [valueInTokens, type, from, to, sender, hot.exchange, recipient, hot.priorityWallet]);

  useEffect(() => {
    reviewSwap();
  }, [reviewSwap]);

  const process = async (review: BridgeReview) => {
    try {
      setProcessing({ status: "processing", message: "Signing transaction", review });
      const result = await hot.exchange.makeSwap(review, { log: (message: string) => setProcessing({ status: "processing", message, review }) });
      setProcessing({ status: "success", message: "Transaction signed", review: result });
      if (setup?.autoClose) onClose();
      return result;
    } catch (e) {
      setProcessing({ status: "error", message: e?.toString?.() ?? "Unknown error", review });
      throw e;
    }
  };

  const cancelReview = () => {
    setReview(null);
    setIsReviewing(false);
    setProcessing(null);
    setIsError(null);
    reviewSwap();
  };

  const handleConfirm = async () => {
    if (sender != "qr") return onProcess(process(review!));
    setProcessing({ status: "qr", message: "Scan QR code to sign transaction", review: review! });
  };

  const handleMax = () => {
    if (sender === "qr") return;
    if (isFiat) {
      setType("exactIn");
      setValue(String(+(availableBalance * from.usd).toFixed(FIXED)));
    } else {
      setType("exactIn");
      setValue(String(availableBalance));
    }
  };

  if (processing?.status === "qr") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <DepositQR //
          review={processing.review}
          onConfirm={() => onProcess(process(processing.review))}
          onCancel={cancelReview}
        />
      </Popup>
    );
  }

  if (processing?.status === "processing") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="loading" src="/loading.json" speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ marginTop: -32, fontSize: 16 }}>{processing.message}</p>
        </div>
      </Popup>
    );
  }

  if (processing?.status === "success") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="success" src="/success.json" speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Exchange successful</p>
        </div>
        <PopupButton style={{ marginTop: "auto" }} onClick={() => (cancelReview(), onClose())}>
          Continue
        </PopupButton>
      </Popup>
    );
  }

  if (processing?.status === "error") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <div style={{ width: "100%", height: 400, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src="/error.json" speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Exchange failed</p>
          <p style={{ fontSize: 14 }}>{processing.message}</p>
        </div>
        <PopupButton onClick={() => (cancelReview(), onClose())}>Continue</PopupButton>
      </Popup>
    );
  }

  const button = () => {
    if (sender == null) return <PopupButton disabled>Set sender</PopupButton>;
    if (recipient == null) return <PopupButton disabled>Set recipient</PopupButton>;
    if (sender !== "qr" && +from.float(hot.balance(sender, from)).toFixed(FIXED) < +amountFrom.toFixed(FIXED)) return <PopupButton disabled>Insufficient balance</PopupButton>;
    return (
      <PopupButton disabled={isReviewing || isError != null} onClick={handleConfirm}>
        {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
      </PopupButton>
    );
  };

  return (
    <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%", height: "100%" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>{from.chain === -4 ? "Withdraw HEX from:" : "Send from:"}</p>
              <BadgeButton onClick={() => openSelectSender({ hot, type: from.type, onSelect: (wallet) => setSender(wallet) })}>
                <p>{formatter.truncateAddress(sender === "qr" ? "QR code" : sender?.address ?? "Connect wallet")}</p>
              </BadgeButton>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview //
              token={from}
              style={{ pointerEvents: setup?.readonlyFrom ? "none" : "all" }}
              onSelect={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setFrom(token), setSender(wallet)) })}
            />

            {isReviewing && type === "exactOut" ? (
              <SkeletonShine />
            ) : (
              <input //
                name="from"
                type="text"
                className="input"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                readOnly={setup?.readonlyAmount}
                value={isFiat ? `$${showAmountFrom}` : showAmountFrom}
                onChange={(e) => (setType("exactIn"), setValue(e.target.value))}
                placeholder="0"
                autoFocus
              />
            )}
          </div>

          {isFiat && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              {sender !== "qr" && (
                <AvailableBalance>
                  <p>Balance: ${from.readable(availableBalance, from.usd)}</p>
                  <RefreshButton onClick={() => sender && hot.fetchToken(from, sender)} />
                </AvailableBalance>
              )}

              {sender === "qr" && <div />}

              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                {from.usd !== 0 && <p style={{ marginRight: 8 }}>{`${from.readable(amountFrom / from.usd)} ${from.symbol}`}</p>}
                {from.usd !== 0 && (
                  <BadgeButton style={{ border: `1px solid #fff` }} onClick={() => setIsFiat(!isFiat)}>
                    USD
                  </BadgeButton>
                )}
                {sender !== "qr" && <BadgeButton onClick={handleMax}>MAX</BadgeButton>}
              </div>
            </div>
          )}

          {!isFiat && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              {sender !== "qr" && (
                <AvailableBalance>
                  <p>Balance: {`${from.readable(availableBalance)} ${from.symbol}`}</p>
                  <RefreshButton onClick={() => sender && hot.fetchToken(from, sender)} />
                </AvailableBalance>
              )}
              {sender === "qr" && <div />}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {from.usd !== 0 && <p style={{ marginRight: 8 }}>${from.readable(amountFrom, from.usd)}</p>}
                {from.usd !== 0 && <BadgeButton onClick={() => setIsFiat(!isFiat)}>USD</BadgeButton>}
                {sender !== "qr" && <BadgeButton onClick={handleMax}>MAX</BadgeButton>}
              </div>
            </div>
          )}
        </Card>

        <div style={{ position: "relative" }}>
          <div style={{ width: "100%", height: 1, backgroundColor: "rgba(255, 255, 255, 0.07)" }} />
          <SwitchButton
            onClick={() => {
              setFrom(to);
              setTo(from);
              setSender(hot.wallets.find((w) => w.address === recipient?.address));
              setRecipient(sender === "qr" ? undefined : sender ? Recipient.fromWallet(sender) : undefined);
              setType(type === "exactIn" ? "exactOut" : "exactIn");
              setValue("");
            }}
          >
            <SwitchIcon />
          </SwitchButton>
        </div>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>{to.chain !== -4 ? "To:" : "Deposit HEX to:"}</p>
              <BadgeButton onClick={() => openSelectRecipient({ hot, recipient, type: to.type, onSelect: (recipient) => setRecipient(recipient) })}>
                <p>{formatter.truncateAddress(recipient?.address ?? "Connect wallet")}</p>
              </BadgeButton>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview //
              token={to}
              style={{ pointerEvents: setup?.readonlyTo ? "none" : "all" }}
              onSelect={() =>
                openSelectTokenPopup({
                  hot,
                  onSelect: (token, wallet) => {
                    setRecipient(wallet ? Recipient.fromWallet(wallet) : undefined);
                    setTo(token);
                  },
                })
              }
            />

            {isReviewing && type === "exactIn" ? (
              <SkeletonShine />
            ) : (
              <input //
                name="to"
                type="text"
                className="input"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                readOnly={setup?.readonlyAmount}
                value={isFiat ? `$${+(+showAmountTo * to.usd).toFixed(FIXED)}` : showAmountTo}
                onChange={(e) => (setType("exactOut"), setValue(e.target.value))}
                placeholder="0"
              />
            )}
          </div>

          <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginTop: -8 }}>
            {isFiat && <p>Receive: ${`${to.readable(amountTo ?? 0)} ${to.symbol}`}</p>}
            {!isFiat && <p>Receive: ${to.readable(amountTo ?? 0, to.usd)}</p>}
          </div>
        </Card>

        <div style={{ marginTop: "auto" }}>{button()}</div>
      </div>
    </Popup>
  );
});

const TokenPreview = ({ style, token, onSelect }: { style?: React.CSSProperties; token: Token; onSelect: (token: Token) => void }) => {
  return (
    <SelectTokenButton style={style} onClick={() => onSelect(token)}>
      <TokenIcon token={token} />
      <p style={{ fontSize: 24, fontWeight: "bold" }}>{token.symbol}</p>
      <ArrowRightIcon style={{ flexShrink: 0, position: "absolute", right: 4 }} />
    </SelectTokenButton>
  );
};

const BadgeButton = styled.button`
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: #282c30;
  padding: 4px 8px;
  border-radius: 16px;
  cursor: pointer;
  outline: none;
  border: none;
  border: 1px solid transparent;
  transition: 0.2s border-color;

  &:hover {
    border-color: #4e4e4e;
  }

  * {
    font-size: 14px;
    font-weight: bold;
  }
`;

const SelectTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  position: relative;
  background: transparent;
  border-radius: 32px;
  padding: 8px;
  padding-right: 32px;
  margin: -8px;
  max-width: 160px;
  transition: 0.2s background-color;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const AvailableBalance = styled.div`
  display: flex;
  align-items: center;
  gap: 4;
  overflow: hidden;
  max-width: 200px;
  white-space: nowrap;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Card = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  text-align: left;
  align-items: flex-start;
  justify-content: center;
  border-radius: 12px;

  input {
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
`;

const SwitchButton = styled.button`
  position: absolute;
  left: 50%;
  top: -18px;
  transform: translate(-50%, 0);
  background: #232323;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  cursor: pointer;
  border: 2px solid #181818;
  box-shadow: 0 2px 8px 0 #18181870;
  outline: none;
  border: none;
  cursor: pointer;
`;

const shine = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const SkeletonShine = styled.div`
  display: inline-block;
  width: 100px;
  height: 40px;
  border-radius: 8px;
  background: #2e2e2e;
  position: relative;
  overflow: hidden;

  &:after {
    content: "";
    display: block;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background: linear-gradient(90deg, rgba(34, 34, 34, 0) 0%, rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0.12) 50%, rgba(255, 255, 255, 0.06) 60%, rgba(34, 34, 34, 0) 100%);
    background-size: 200px 100%;
    animation: ${shine} 1.4s infinite linear;
  }
`;

const RefreshButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <svg
      onClick={onClick}
      style={{ width: 18, height: 18, verticalAlign: "middle", marginLeft: 8, cursor: "pointer", opacity: 0.7, transition: "opacity 0.2s" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseOut={(e) => (e.currentTarget.style.opacity = "0.7")}
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.13-3.36L23 10" />
      <path d="M20.49 15a9 9 0 01-14.13 3.36L1 14" />
    </svg>
  );
};
