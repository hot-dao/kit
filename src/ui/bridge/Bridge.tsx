import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";
import uuid4 from "uuid4";

import { ArrowRightIcon } from "../icons/arrow-right";
import ExchangeIcon from "../icons/exchange";

import { HotKit } from "../../HotKit";
import { chains, Network, WalletType } from "../../core/chains";
import { BridgeReview } from "../../core/exchange";
import { OmniWallet } from "../../core/OmniWallet";
import { Recipient } from "../../core/recipient";
import { formatter } from "../../core/utils";
import { tokens } from "../../core/tokens";
import { Token } from "../../core/token";

import { useAnimations } from "../uikit/animationts";
import { H5, PSmall, PTiny } from "../uikit/text";
import { ActionButton } from "../uikit/button";
import { Skeleton } from "../uikit/loader";
import { ImageView } from "../uikit/image";

import Popup from "../Popup";
import DepositQR from "../profile/DepositQR";
import { BadgeButton, Card, CardBody, CardHeader, ChainButton, TokenAmountCard, TokenPreview, Tooltip } from "./TokenAmountCard";

export interface ProcessingState {
  status: "qr" | "processing" | "success" | "error";
  resolve?: (value: BridgeReview) => void;
  reject?: (error: Error) => void;
  message?: string;
  review: BridgeReview;
}

export interface BridgeProps {
  kit: HotKit;
  widget?: boolean;
  onClose: () => void;
  onStateUpdate?: (state: ProcessingState | null) => void;
  onProcess: (task: Promise<BridgeReview>) => void;
  onSelectPair?: (from: Token, to: Token) => void;
  setup?: {
    mobileFullscreen?: boolean;
    autoClose?: boolean; // if true, the popup will close automatically when the transaction is successful
    title?: string;
    readonlyAmount?: boolean;
    type?: "exactIn" | "exactOut";
    sender?: OmniWallet;
    recipient?: Recipient;
    amount?: number;
    from?: Token;
    to?: Token;
  };
}

const FIXED = 6;

export const Bridge = observer(({ kit, widget, setup, onClose, onProcess, onStateUpdate, onSelectPair }: BridgeProps) => {
  const [type, setType] = useState<"exactIn" | "exactOut">(setup?.type || "exactIn");
  const [from, setFrom] = useState<Token>(setup?.from || tokens.list.find((t) => t.id === localStorage.getItem("bridge:from")) || tokens.list.find((t) => t.symbol === "NEAR")!);
  const [to, setTo] = useState<Token>(setup?.to || tokens.list.find((t) => t.id === localStorage.getItem("bridge:to")) || tokens.list.find((t) => t.symbol === "USDT")!);
  const [value, setValue] = useState<string>(setup?.amount?.toFixed(6) ?? "");
  const [isFiat, setIsFiat] = useState(false);

  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const animations = useAnimations();

  useEffect(() => {
    onStateUpdate?.(processing);
  }, [processing]);

  useEffect(() => {
    onSelectPair?.(from, to);
  }, [from, to]);

  const [sender, setSender] = useState<OmniWallet | "qr" | undefined>(() => {
    if (setup?.sender) return setup.sender;
    if (from.type === WalletType.OMNI) return kit.priorityWallet;
    return kit.wallets.find((w) => w.type === from.type);
  });

  useEffect(() => {
    if (from.type === WalletType.OMNI) setSender(kit.priorityWallet);
    if (to.type === WalletType.OMNI) setRecipient(Recipient.fromWallet(kit.priorityWallet!));
  }, [kit.priorityWallet]);

  const [recipient, setRecipient] = useState<Recipient | undefined>(() => {
    if (setup?.recipient) return setup.recipient;
    if (to.type === WalletType.OMNI) return Recipient.fromWallet(kit.priorityWallet!);
    return Recipient.fromWallet(kit.wallets.find((w) => w.type === to.type)!);
  });

  const initialSender = useRef<OmniWallet | "qr" | undefined>(sender);
  const initialRecipient = useRef<Recipient | undefined>(recipient);

  const valueInTokens = isFiat ? +formatter.fromInput(value) / (type === "exactIn" ? from.usd : to.usd) : +formatter.fromInput(value);
  const amountFrom = type === "exactOut" ? from.float(review?.amountIn ?? 0) : valueInTokens;
  const amountTo = type === "exactIn" ? to.float(review?.amountOut ?? 0) : valueInTokens;

  const showAmountFrom = type === "exactOut" ? +from.float(review?.amountIn ?? 0).toFixed(FIXED) : formatter.fromInput(value);
  const showAmountTo = type === "exactIn" ? +to.float(review?.amountOut ?? 0).toFixed(FIXED) : formatter.fromInput(value);

  const availableBalance = sender !== "qr" ? +Math.max(0, from.float(kit.balance(sender, from)) - from.reserve).toFixed(FIXED) : 0;

  let title = "Exchange";
  if (from.chain === Network.HotCraft || from.chain === Network.Omni) title = `Withdraw ${from.symbol}`;
  if (to.chain === Network.HotCraft || to.chain === Network.Omni) title = `Deposit ${to.symbol}`;
  if (to.chain === from.chain) title = "Exchange";

  useEffect(() => {
    localStorage.setItem("bridge:from", from.id);
    localStorage.setItem("bridge:to", to.id);
  }, [from, to]);

  useEffect(() => {
    if (initialSender.current == null) {
      if (from.type === WalletType.OMNI) setSender(kit.priorityWallet);
      else setSender(kit.wallets.find((w) => w.type === from.type));
    }

    if (initialRecipient.current == null) {
      if (to.type === WalletType.OMNI) setRecipient(Recipient.fromWallet(kit.priorityWallet));
      else setRecipient(Recipient.fromWallet(kit.wallets.find((w) => w.type === to.type)));
    }
  }, [to, from, kit.wallets, kit.priorityWallet]);

  const reviewId = useRef(uuid4());
  const throwError = (message: string) => {
    setIsError(message);
    setIsReviewing(false);
  };

  const openTooltip = (id: string) => {
    const tooltip = document.getElementById(id);
    if (!tooltip) return;
    tooltip.style.transform = "translateY(0)";
    tooltip.style.opacity = "1";
    setTimeout(() => {
      tooltip.style.transform = "translateY(8px)";
      tooltip.style.opacity = "0";
    }, 3000);
  };

  const refundWallet = sender !== "qr" ? sender : kit.priorityWallet;
  const reviewSwap = useCallback(() => {
    reviewId.current = uuid4();
    const currentReviewId = reviewId.current;
    setIsReviewing(true);
    setReview(null);
    setIsError(null);

    if (valueInTokens <= 0) return throwError("Enter amount");
    const debounceTimer = setTimeout(async () => {
      try {
        if (currentReviewId !== reviewId.current) return;
        const amount = type === "exactIn" ? from.int(valueInTokens) : to.int(valueInTokens);
        const review = await kit.exchange.reviewSwap({ recipient, slippage: 0.005, sender, refund: refundWallet, amount, type, from, to });
        if (currentReviewId !== reviewId.current) return;

        if (amount > 0) {
          if (!sender) setTimeout(() => openTooltip("sender-tooltip"), 100);
          if (!recipient) openTooltip("recipient-tooltip");
        }

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
  }, [valueInTokens, type, from, to, sender, kit.exchange, recipient, kit.priorityWallet]);

  useEffect(() => {
    reviewSwap();
  }, [reviewSwap]);

  const process = async (review: BridgeReview) => {
    try {
      const log = (message: string) => setProcessing({ status: "processing", message, review });
      kit.exchange.bridge.logger = { log, warn: console.warn };
      log("Signing transaction");

      review.logger = { log };
      const pending = await kit.exchange.makeSwap(review);

      setProcessing({ status: "success", review: pending.review });
      kit.activity.addBridgePending(pending);

      if (setup?.autoClose) onClose();
      return pending.review;
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

  if (processing?.status === "qr" && typeof processing.review.qoute === "object") {
    return (
      <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen}>
        <DepositQR //
          depositAmount={processing.review.qoute.amountInFormatted}
          depositAddress={processing.review.qoute.depositAddress!}
          onConfirm={() => onProcess(process(processing.review))}
          onCancel={cancelReview}
          token={from}
          kit={kit}
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
          <H5 style={{ marginTop: -32 }}>{processing.message}</H5>
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
          <H5 style={{ marginTop: -32 }}>{title} in progress</H5>
          <PSmall style={{ marginTop: 8 }}>You can track your transaction in the activity</PSmall>
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
        <div style={{ width: "100%", height: 400, marginBottom: 8, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <H5 style={{ marginTop: -32 }}>{title} failed</H5>
          <TextField>{processing.message}</TextField>
        </div>

        <ActionButton style={{ marginTop: "auto" }} onClick={() => (cancelReview(), onClose())}>
          Continue
        </ActionButton>
      </Popup>
    );
  }

  const button = () => {
    if (sender == null) return <ActionButton disabled>Confirm</ActionButton>;
    if (recipient == null) return <ActionButton disabled>Confirm</ActionButton>;
    if (refundWallet == null) return <ActionButton onClick={() => kit.router.openConnector(kit)}>Sign in to HEX</ActionButton>;
    if (sender !== "qr" && +from.float(kit.balance(sender, from)).toFixed(FIXED) < +amountFrom.toFixed(FIXED)) return <ActionButton disabled>Insufficient balance</ActionButton>;
    return (
      <ActionButton style={{ width: "100%", marginTop: 40 }} disabled={isReviewing || isError != null} onClick={handleConfirm}>
        {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
      </ActionButton>
    );
  };

  return (
    <Popup widget={widget} onClose={onClose} header={<p>{title}</p>} mobileFullscreen={setup?.mobileFullscreen} style={{ background: "#191919" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", height: "100%" }}>
        <TokenAmountCard
          token={from}
          isFiat={isFiat}
          sender={sender}
          amount={amountFrom}
          readableAmount={String(showAmountFrom)}
          readonlyAmount={setup?.readonlyAmount}
          availableBalance={availableBalance}
          isReviewing={isReviewing && type === "exactOut"}
          handleSelectSender={(token) =>
            kit.router.openSelectSender({
              kit,
              disableQR: true,
              depositFlow: !token.isOmni,
              type: token.type,
              onSelect: (sender) => setSender(sender as OmniWallet),
              onDeposit: () => {
                kit.router.openDepositFlow(kit, from);
                setFrom(tokens.get(from.omniAddress));
              },
            })
          }
          handleSelectToken={() =>
            kit.router.openSelectTokenPopup({
              kit,
              onSelect: (token) => {
                if (sender == null || sender === "qr") setSender(undefined);
                else setSender(kit.wallets.find((w) => w.type === token.type));
                setFrom(token);
              },
            })
          }
          setValue={(v) => (setValue(v), setType("exactIn"))}
          setIsFiat={setIsFiat}
          handleMax={handleMax}
          kit={kit}
        />

        <div style={{ position: "relative", height: 1, width: "100%" }}>
          <SwitchButton
            onClick={() => {
              setFrom(to);
              setTo(from);
              setSender(kit.wallets.find((w) => w.address === recipient?.address));
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
            <ChainButton onClick={() => kit.router.openSelectTokenPopup({ kit, onSelect: (token, wallet) => (setTo(token), setRecipient(Recipient.fromWallet(wallet))) })}>
              <PSmall>To</PSmall>
              <ImageView src={chains.get(to.chain)?.logo || ""} alt={to.symbol} size={16} />
              <PSmall>{chains.get(to.chain)?.name}</PSmall>
              <ArrowRightIcon style={{ marginLeft: -8, transform: "rotate(-270deg)" }} color="#ababab" />
            </ChainButton>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PSmall>Recipient:</PSmall>
              <BadgeButton onClick={() => kit.router.openSelectRecipient({ kit, chain: to.chain, onSelect: (recipient) => setRecipient(recipient) })}>
                <PSmall>{recipient == null ? "Select" : formatter.truncateAddress(recipient.address, 8)}</PSmall>
                <Tooltip id="recipient-tooltip">
                  <PSmall>Select recipient wallet</PSmall>
                </Tooltip>
              </BadgeButton>
            </div>
          </CardHeader>

          <CardBody style={{ borderRadius: "0 0 20px 20px" }}>
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <TokenPreview
                token={to}
                onSelect={() =>
                  kit.router.openSelectTokenPopup({
                    kit,
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

const TextField = styled(PTiny)`
  max-width: 100%;
  min-width: 300px;
  min-height: 64px;
  overflow: auto;
  max-height: 200px;
  background: #2c2c2c;
  border-radius: 12px;
  font-size: 12px;
  padding: 8px;
  margin-bottom: 12px;
  white-space: pre-wrap;
  line-break: anywhere;
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
