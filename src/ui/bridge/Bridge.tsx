import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import uuid4 from "uuid4";

import { ArrowRightIcon } from "../icons/arrow-right";
import ExchangeIcon from "../icons/exchange";
import RefreshIcon from "../icons/refresh";

import { HotConnector } from "../../HotConnector";
import { chains, WalletType } from "../../core/chains";
import { BridgeReview } from "../../core/exchange";
import { OmniWallet } from "../../core/OmniWallet";
import { Recipient } from "../../core/recipient";
import { formatter } from "../../core/utils";
import { tokens } from "../../core/tokens";
import { Token } from "../../core/token";

import { ActionButton, Button } from "../uikit/button";
import { PLarge, PSmall, PTiny } from "../uikit/text";
import { Skeleton } from "../uikit/loader";
import { ImageView } from "../uikit/image";

import Popup from "../Popup";
import { openSelectRecipient, openSelectSender, openSelectTokenPopup, openWalletPicker } from "../router";
import DepositQR from "../profile/DepositQR";
import { TokenIcon } from "./TokenCard";

const animations = {
  success: "https://hex.exchange/success.json",
  failed: "https://hex.exchange/error.json",
  loading: "https://hex.exchange/loading.json",
};

export interface BridgeProps {
  hot: HotConnector;
  widget?: boolean;
  onClose: () => void;
  onProcess: (task: Promise<BridgeReview>) => void;
  onSelectPair?: (from: Token, to: Token) => void;
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

export const Bridge = observer(({ hot, widget, setup, onClose, onProcess, onSelectPair }: BridgeProps) => {
  const [isFiat, setIsFiat] = useState(false);
  const [type, setType] = useState<"exactIn" | "exactOut">(setup?.type || "exactIn");
  const [value, setValue] = useState<string>(setup?.amount?.toFixed(6) ?? "");
  const [from, setFrom] = useState<Token>(setup?.from || tokens.list.find((t) => t.id === localStorage.getItem("bridge:from")) || tokens.list.find((t) => t.symbol === "NEAR")!);
  const [to, setTo] = useState<Token>(setup?.to || tokens.list.find((t) => t.id === localStorage.getItem("bridge:to")) || tokens.list.find((t) => t.symbol === "USDT")!);

  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  useState(() => {
    fetch(animations.loading);
    fetch(animations.success);
    fetch(animations.failed);
  });

  const [processing, setProcessing] = useState<{
    status: "qr" | "processing" | "success" | "error";
    resolve?: (value: BridgeReview) => void;
    reject?: (error: Error) => void;
    message: string;
    review: BridgeReview;
  } | null>(null);

  useEffect(() => {
    onSelectPair?.(from, to);
  }, [from, to]);

  const [sender, setSender] = useState<OmniWallet | "qr" | undefined>(() => {
    if (setup?.sender) return setup.sender;
    if (from.type === WalletType.OMNI) return hot.priorityWallet;
    return hot.wallets.find((w) => w.type === from.type);
  });

  useEffect(() => {
    if (from.type === WalletType.OMNI) setSender(hot.priorityWallet);
    if (to.type === WalletType.OMNI) setRecipient(Recipient.fromWallet(hot.priorityWallet!));
  }, [hot.priorityWallet]);

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
        const recipientWallet = hot.wallets.find((w) => w.address === recipient?.address && w.type === recipient?.type) || recipient;
        const review = await hot.exchange.reviewSwap({ recipient: recipientWallet, slippage: 0.005, sender, refund, amount, type, from, to });
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
      const log = (message: string) => setProcessing({ status: "processing", message, review });
      hot.exchange.bridge.logger = { log, warn: console.warn };
      log("Signing transaction");

      review.logger = { log };
      const result = await hot.exchange.makeSwap(review);
      let resultReview = result.review;

      if (result.processing) {
        log("Waiting for transaction to be confirmed");
        resultReview = await result.processing();
      }

      setProcessing({ status: "success", message: "Transaction signed", review: resultReview });
      if (setup?.autoClose) onClose();
      return resultReview;
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
          <dotlottie-wc key="loading" src={animations.loading} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
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
          <dotlottie-wc key="success" src={animations.success} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>{title} successful</p>
        </div>
        <ActionButton style={{ marginTop: "auto" }} onClick={() => (cancelReview(), onClose())}>
          Continue
        </ActionButton>
      </Popup>
    );
  }

  if (processing?.status === "error") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <div style={{ width: "100%", height: 400, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>{title} failed</p>
          <p style={{ fontSize: 14 }}>{processing.message}</p>
        </div>
        <ActionButton onClick={() => (cancelReview(), onClose())}>Continue</ActionButton>
      </Popup>
    );
  }

  const button = () => {
    if (sender == null) return <ActionButton disabled>Set sender</ActionButton>;
    if (recipient == null) return <ActionButton disabled>Set recipient</ActionButton>;
    if (sender !== "qr" && +from.float(hot.balance(sender, from)).toFixed(FIXED) < +amountFrom.toFixed(FIXED)) return <ActionButton disabled>Insufficient balance</ActionButton>;
    return (
      <ActionButton style={{ width: "100%", marginTop: 40 }} disabled={isReviewing || isError != null} onClick={handleConfirm}>
        {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
      </ActionButton>
    );
  };

  return (
    <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen} style={{ background: "#191919" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", height: "100%" }}>
        <Card style={{ borderRadius: "20px 20px 2px 2px" }}>
          <CardHeader>
            <ChainButton onClick={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setFrom(token), setSender(wallet)) })}>
              <PSmall>From</PSmall>
              <ImageView src={chains.get(from.chain)?.logo || ""} alt={from.symbol} size={16} />
              <PSmall>{chains.get(from.chain)?.name}</PSmall>
              <ArrowRightIcon style={{ marginLeft: -8, transform: "rotate(-270deg)" }} color="#ababab" />
            </ChainButton>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PSmall>Sender:</PSmall>
              <BadgeButton
                onClick={() => {
                  if (from.type === WalletType.OMNI) openSelectSender({ hot, type: from.type, onSelect: (sender) => setSender(sender) });
                  else openWalletPicker(hot.getWalletConnector(from.type)!, (wallet) => setSender(wallet));
                }}
              >
                <PSmall>{sender == null ? "Select" : sender !== "qr" ? formatter.truncateAddress(sender.address, 8) : "QR"}</PSmall>
              </BadgeButton>
            </div>
          </CardHeader>

          <CardBody>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <TokenPreview //
                onSelect={() => openSelectTokenPopup({ onSelect: (token, wallet) => (setFrom(token), setSender(wallet)), initialChain: from.chain, hot })}
                style={{ pointerEvents: setup?.readonlyFrom ? "none" : "all" }}
                token={from}
              />

              {isReviewing && type === "exactOut" ? (
                <Skeleton />
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
                    <PSmall>Balance: ${from.readable(availableBalance, from.usd)}</PSmall>
                    <Button onClick={() => sender && hot.fetchToken(from, sender)}>
                      <RefreshIcon color="#fff" />
                    </Button>
                  </AvailableBalance>
                )}

                {sender === "qr" && <div />}

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {from.usd !== 0 && <PSmall style={{ marginRight: 8 }}>{`${from.readable(amountFrom / from.usd)} ${from.symbol}`}</PSmall>}

                  {from.usd !== 0 && (
                    <BadgeButton style={{ border: `1px solid #fff` }} onClick={() => setIsFiat(!isFiat)}>
                      <PTiny>USD</PTiny>
                    </BadgeButton>
                  )}

                  {sender !== "qr" && (
                    <BadgeButton onClick={handleMax}>
                      <PTiny>MAX</PTiny>
                    </BadgeButton>
                  )}
                </div>
              </div>
            )}

            {!isFiat && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                {sender !== "qr" && (
                  <AvailableBalance>
                    <PSmall>Balance: {`${from.readable(availableBalance)} ${from.symbol}`}</PSmall>
                    <Button style={{ marginTop: 2 }} onClick={() => sender && hot.fetchToken(from, sender)}>
                      <RefreshIcon color="#fff" />
                    </Button>
                  </AvailableBalance>
                )}
                {sender === "qr" && <div />}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {from.usd !== 0 && <PSmall style={{ marginRight: 8 }}>${from.readable(amountFrom, from.usd)}</PSmall>}
                  {from.usd !== 0 && (
                    <BadgeButton onClick={() => setIsFiat(!isFiat)}>
                      <PTiny>USD</PTiny>
                    </BadgeButton>
                  )}
                  {sender !== "qr" && (
                    <BadgeButton onClick={handleMax}>
                      <PTiny>MAX</PTiny>
                    </BadgeButton>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <div style={{ position: "relative", height: 1, width: "100%" }}>
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
            <ExchangeIcon color="#fff" width={22} height={22} style={{ flexShrink: 0, transform: "rotate(270deg)" }} />
          </SwitchButton>
        </div>

        <Card style={{ borderRadius: "2px 2px 20px 20px" }}>
          <CardHeader>
            <ChainButton onClick={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setTo(token), setRecipient(wallet)) })}>
              <PSmall>To</PSmall>
              <ImageView src={chains.get(to.chain)?.logo || ""} alt={to.symbol} size={16} />
              <PSmall>{chains.get(to.chain)?.name}</PSmall>
              <ArrowRightIcon style={{ marginLeft: -8, transform: "rotate(-270deg)" }} color="#ababab" />
            </ChainButton>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PSmall>Recipient:</PSmall>
              <BadgeButton onClick={() => openSelectRecipient({ hot, chain: to.chain, onSelect: (recipient) => setRecipient(recipient) })}>
                <PSmall>{recipient == null ? "Select" : formatter.truncateAddress(recipient.address, 8)}</PSmall>
              </BadgeButton>
            </div>
          </CardHeader>

          <CardBody style={{ borderRadius: "0 0 20px 20px" }}>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <TokenPreview //
                token={to}
                style={{ pointerEvents: setup?.readonlyTo ? "none" : "all" }}
                onSelect={() =>
                  openSelectTokenPopup({
                    hot,
                    initialChain: to.chain,
                    onSelect: (token, wallet) => {
                      setRecipient(wallet ? Recipient.fromWallet(wallet) : undefined);
                      setTo(token);
                    },
                  })
                }
              />

              {isReviewing && type === "exactIn" ? (
                <Skeleton />
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

            <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
              {isFiat && <PSmall>To receive: ${`${to.readable(amountTo ?? 0)} ${to.symbol}`}</PSmall>}
              {!isFiat && <PSmall>To receive: ${to.readable(amountTo ?? 0, to.usd)}</PSmall>}
            </div>
          </CardBody>
        </Card>

        <div style={{ marginTop: "auto" }}>{button()}</div>
      </div>
    </Popup>
  );
});

const TokenPreview = ({ style, token, onSelect }: { style?: React.CSSProperties; token: Token; onSelect: (token: Token) => void }) => {
  return (
    <SelectTokenButton style={style} onClick={() => onSelect(token)}>
      <TokenIcon withoutChain token={token} size={32} />
      <PLarge>{token.symbol}</PLarge>
      <ArrowRightIcon style={{ flexShrink: 0, position: "absolute", right: 4 }} />
    </SelectTokenButton>
  );
};

const BadgeButton = styled.button`
  display: flex;
  border-radius: 8px;
  border: 1px solid #323232;
  padding: 4px 8px;
  background: transparent;
  transition: 0.2s border-color;
  cursor: pointer;
  outline: none;
  gap: 4px;

  &:hover {
    border-color: #4e4e4e;
  }
`;

const ChainButton = styled.button`
  display: flex;
  align-items: center;
  padding: 0;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  background: transparent;
  transition: 0.2s opacity;

  &:hover {
    opacity: 0.8;
  }
`;

const SelectTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  position: relative;
  background: transparent;
  border-radius: 24px;
  padding: 4px;
  padding-right: 28px;
  margin: -4px;
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
  overflow: hidden;
  max-width: 200px;
  white-space: nowrap;
  gap: 4px;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Card = styled.div`
  text-align: left;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;

  display: flex;
  width: 100%;

  border-radius: 20px 20px 2px 2px;
  border: 1px solid #323232;
  background: #1f1f1f;

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

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  width: 100%;
  gap: 8px;
`;

const CardBody = styled.div`
  padding: 16px;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #323232;
  background: #272727;
  display: flex;
  gap: 8px;
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
  outline: none;

  border-radius: 24px;
  border: 4px solid #191919;
  background: #323232;
`;
