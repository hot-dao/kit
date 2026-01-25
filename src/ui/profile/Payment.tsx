import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import styled from "styled-components";

import { HelpIcon } from "../icons/help";
import { WalletIcon } from "../icons/wallet";

import { Commitment, Intents } from "../../core";
import { BridgeReview } from "../../core/exchange";
import { OmniWallet } from "../../core/OmniWallet";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";

import { HorizontalStepper } from "../uikit/Stepper";
import { ActionButton } from "../uikit/button";
import { H6, PSmall } from "../uikit/text";
import { Loader } from "../uikit/loader";

import { PopupOption, PopupOptionInfo } from "../styles";
import { HotConnector } from "../../HotConnector";
import { TokenCard } from "../bridge/TokenCard";
import { openConnector } from "../router";
import Popup from "../Popup";

interface PaymentProps {
  onReject: (message: string) => void;
  onConfirm: (args: { depositQoute?: BridgeReview; processing?: () => Promise<BridgeReview> }) => Promise<void>;
  close: () => void;
  excludedTokens?: string[];
  allowedTokens?: string[];
  prepaidAmount: bigint;
  payableToken: Token;
  needAmount: bigint;
  connector: HotConnector;
  intents: Intents;
  title?: string;
}

const animations = {
  success: "https://hex.exchange/success.json",
  failed: "https://hex.exchange/error.json",
  loading: "https://hex.exchange/loading.json",
};

const PAY_SLIPPAGE = 0.002;
const STABLE_SLIPPAGE = 0.001;

export const Payment = observer(({ connector, intents, title = "Payment", allowedTokens, excludedTokens, prepaidAmount, payableToken, needAmount, onReject, onConfirm, close }: PaymentProps) => {
  useState(() => {
    fetch(animations.loading);
    fetch(animations.success);
    fetch(animations.failed);
  });

  useEffect(() => {
    if (connector.wallets.length !== 0) return;
    openConnector(connector);
  }, [connector.wallets.length]);

  const [flow, setFlow] = useState<{
    token?: Token;
    wallet?: OmniWallet;
    commitment?: Commitment;
    review?: BridgeReview;
    success?: { depositQoute?: BridgeReview; processing?: () => Promise<BridgeReview> };
    step?: "selectToken" | "sign" | "transfer" | "success" | "error" | "loading";
    loading?: boolean;
    error?: any;
  } | null>(needAmount === 0n ? { step: "transfer" } : null);

  const paymentTitle = title || `Pay ${payableToken.readable(needAmount)} ${payableToken.symbol}`;
  const showPrepaidToken = payableToken.float(prepaidAmount) >= 0.001;

  const selectToken = async (from: Token, wallet?: OmniWallet) => {
    if (!wallet) return;

    setFlow({ token: from, wallet, review: undefined, step: "sign" });
    const isStableFrom = from.symbol === "USDT" || from.symbol === "USDC";
    const isStableTo = payableToken.symbol === "USDT" || payableToken.symbol === "USDC";
    const isDirectDeposit = connector.exchange.isDirectDeposit(from, payableToken);
    const isStable = isStableFrom && isStableTo;

    let tasks: Promise<BridgeReview>[] = [];
    if (isStable && !isDirectDeposit) {
      const slippages = [0.0005, 0.001, 0.0015];
      tasks = slippages.map((slippage) => {
        const extra = (needAmount * BigInt(Math.floor(slippage * 1000))) / BigInt(1000);
        return connector.exchange.reviewSwap({
          amount: from.int(payableToken.float(needAmount + extra)),
          recipient: intents.signer!,
          slippage: slippage,
          sender: wallet,
          refund: wallet,
          type: "exactIn",
          to: payableToken,
          from,
        });
      });
    }

    const exectOutReview = await connector.exchange
      .reviewSwap({
        slippage: isStable ? STABLE_SLIPPAGE : PAY_SLIPPAGE,
        recipient: intents.signer!,
        amount: needAmount,
        sender: wallet,
        refund: wallet,
        type: "exactOut",
        to: payableToken,
        from,
      })
      .catch((e) => {
        console.error(e);
        return null;
      });

    for (const task of tasks) {
      const review = await task.catch((e) => {
        console.error(e);
        return null;
      });

      if (!review) continue;
      if (review.minAmountOut < needAmount) continue;
      if (exectOutReview != null && review.amountIn > exectOutReview.amountIn) continue;
      return setFlow({ token: from, wallet, review, step: "sign" });
    }

    if (exectOutReview == null) return setFlow({ token: from, wallet, error: true, step: "sign" });
    setFlow({ token: from, wallet, review: exectOutReview, step: "sign" });
  };

  const signStep = async () => {
    try {
      setFlow((t) => (t ? { ...t, step: "sign", loading: true } : null));
      await intents.sign();
      setFlow((t) => (t ? { ...t, step: "transfer", loading: false } : null));
    } catch (error) {
      console.error(error);
      setFlow((t) => (t ? { ...t, step: "error", loading: false, error } : null));
      throw error;
    }
  };

  const confirmPaymentStep = async () => {
    try {
      setFlow((t) => (t ? { ...t, step: "loading" } : null));

      if (flow?.review == null) {
        await intents.sign();
        await onConfirm({});
        setFlow({ loading: false, step: "success" });
        setTimeout(() => close(), 2000);
        return;
      }

      flow.review.logger = console;
      const result = await connector.exchange.makeSwap(flow.review);
      await onConfirm({ depositQoute: result.review, processing: result.processing });
      setFlow({ loading: false, step: "success" });
      setTimeout(() => close(), 2000);
    } catch (error) {
      console.error(error);
      setFlow((t) => (t ? { ...t, step: "error", loading: false, error } : null));
      throw error;
    }
  };

  if (flow?.step === "success") {
    return (
      <Popup header={<p>{paymentTitle}</p>}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="success" src={animations.success} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Transaction successful</p>
        </div>

        <ActionButton style={{ marginTop: "auto" }} onClick={() => close()}>
          Continue
        </ActionButton>
      </Popup>
    );
  }

  if (flow?.step === "loading") {
    return (
      <Popup header={<p>{paymentTitle}</p>}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="loading" src={animations.loading} speed="1" style={{ marginTop: -64, width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -16, fontWeight: "bold" }}>Transaction processing</p>
        </div>
      </Popup>
    );
  }

  if (flow?.step === "error") {
    return (
      <Popup header={<p>{paymentTitle}</p>}>
        <div style={{ width: "100%", height: 400, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Transaction failed</p>
          <p style={{ fontSize: 14, width: "80%", textAlign: "center", overflowY: "auto", lineBreak: "anywhere" }}>{formatter.serializeError(flow.error)}</p>
        </div>
        <ActionButton onClick={() => onReject(formatter.serializeError(flow.error))}>Close</ActionButton>
      </Popup>
    );
  }

  if (flow?.step === "transfer") {
    return (
      <Popup onClose={() => onReject("closed")} header={<p>{paymentTitle}</p>}>
        <HorizontalStepper style={{ marginBottom: 24 }} steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={2} />

        <div style={{ textAlign: "left" }}>
          <H6>Confirm transfer</H6>
          <PSmall>Transfer approved. Click confirm to make the payment.</PSmall>
        </div>

        <div style={{ marginTop: 8, position: "relative", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          {showPrepaidToken && <TokenCard token={payableToken} hot={connector} wallet={intents.signer} amount={prepaidAmount} />}

          {flow.token != null && (
            <TokenCard //
              hot={connector}
              token={flow.token}
              wallet={flow.wallet}
              amount={flow.review == null ? needAmount : flow.review?.amountIn ?? 0n}
            />
          )}

          {showPrepaidToken && flow.token != null && (
            <PlusButton>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="11" y="4" width="2" height="16" rx="1" fill="#fff" />
                <rect x="4" y="11" width="16" height="2" rx="1" fill="#fff" />
              </svg>
            </PlusButton>
          )}
        </div>

        {flow.review && flow.review.amountOut - flow.review.minAmountOut > 0n && (
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <HelpIcon style={{ flexShrink: 0, marginTop: 4, width: 20, height: 20 }} />
            <PSmall style={{ textAlign: "left" }}>
              Due to slippage, your HEX balance may return up to{" "}
              <b>
                {flow.review.to.readable(flow.review.amountOut - flow.review.minAmountOut)} {flow.review.to.symbol}
              </b>{" "}
              after the transaction is completed
            </PSmall>
          </div>
        )}

        <ActionButton style={{ marginTop: 24 }} onClick={confirmPaymentStep}>
          {flow?.loading ? "Transferring..." : "Confirm transfer"}
        </ActionButton>
      </Popup>
    );
  }

  if (flow?.step === "sign") {
    const rightControl = <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>{flow.error ? <ErrorIcon /> : <Loader />}</div>;

    return (
      <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
        <HorizontalStepper style={{ marginBottom: 24 }} steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={1} />

        <div style={{ textAlign: "left" }}>
          <H6>Approve transfer</H6>
          <PSmall>Click the button below to approve the transfer</PSmall>
        </div>

        <div style={{ marginTop: 8, position: "relative", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          {showPrepaidToken && <TokenCard token={payableToken} hot={connector} wallet={intents.signer} amount={prepaidAmount} />}

          {flow.token != null && (
            <TokenCard //
              hot={connector}
              token={flow.token}
              wallet={flow.wallet}
              rightControl={flow.review ? undefined : rightControl}
              amount={flow.review == null ? needAmount : flow.review?.amountIn ?? 0n}
            />
          )}

          {showPrepaidToken && flow.token != null && (
            <PlusButton>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="11" y="4" width="2" height="16" rx="1" fill="#fff" />
                <rect x="4" y="11" width="16" height="2" rx="1" fill="#fff" />
              </svg>
            </PlusButton>
          )}
        </div>

        {flow.review && flow.review.amountOut - flow.review.minAmountOut > 0n && (
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <HelpIcon style={{ flexShrink: 0, marginTop: 4, width: 20, height: 20 }} />
            <PSmall style={{ textAlign: "left" }}>
              Due to slippage, your HEX balance may return up to{" "}
              <b>
                {flow.review.to.readable(flow.review.amountOut - flow.review.minAmountOut)} {flow.review.to.symbol}
              </b>{" "}
              after the transaction is completed
            </PSmall>
          </div>
        )}

        {flow.error ? (
          <>
            <ActionButton $stroke style={{ marginTop: 24 }} onClick={() => selectToken(flow.token!, flow.wallet!)}>
              Try again
            </ActionButton>
            <ActionButton style={{ marginTop: 8 }} onClick={() => setFlow(null)}>
              Select another token
            </ActionButton>
          </>
        ) : (
          <ActionButton style={{ marginTop: 24 }} disabled={!flow?.review} onClick={signStep}>
            {flow?.loading ? "Approving..." : flow?.review ? "Approve transfer" : "Quoting..."}
          </ActionButton>
        )}
      </Popup>
    );
  }

  const recommendedTokens = connector.walletsTokens.filter((t) => t.token.symbol === "USDT" || t.token.symbol === "USDC");
  const otherTokens = connector.walletsTokens.filter((t) => t.token.symbol !== "USDT" && t.token.symbol !== "USDC");

  const renderToken = (token: Token, wallet: OmniWallet, balance: bigint) => {
    if (token.id === payableToken.id && connector.priorityWallet?.type === wallet.type) return null;
    const availableBalance = token.float(balance) - token.reserve;

    // Allow only tokens in the allowedTokens list
    if (allowedTokens != null && !allowedTokens?.includes(token.id)) return null;

    // Exclude tokens in the excludedTokens list
    if (excludedTokens != null && excludedTokens?.includes(token.id)) return null;

    // same token as need and enough balance is direct deposit
    if (token.originalId === payableToken.originalId && availableBalance >= payableToken.float(needAmount)) {
      return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
    }

    if (availableBalance * token.usd <= payableToken.usd * payableToken.float(needAmount) * (1 + PAY_SLIPPAGE)) return null;
    return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
  };

  return (
    <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
      <HorizontalStepper style={{ marginBottom: 24 }} steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={0} />

      {recommendedTokens.map(({ token, wallet, balance }) => renderToken(token, wallet, balance))}
      {otherTokens.map(({ token, wallet, balance }) => renderToken(token, wallet, balance))}

      <PopupOption style={{ marginTop: 8 }} onClick={() => openConnector(connector)}>
        <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WalletIcon />
        </div>
        <PopupOptionInfo>
          <p>Don't find the right token?</p>
          <span className="wallet-address">Connect another wallet</span>
        </PopupOptionInfo>
      </PopupOption>
    </Popup>
  );
});

const ErrorIcon = () => {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Failed" style={{ display: "block", margin: "0 auto" }}>
      <circle cx="14" cy="14" r="13" stroke="#E74C3C" strokeWidth="2" />
      <path d="M9 9l10 10M19 9l-10 10" stroke="#E74C3C" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

const PlusButton = styled.button`
  position: absolute;
  left: 50%;
  top: 50%;
  margin-top: -14px;
  margin-left: -16px;

  border-radius: 50%;
  width: 30px;
  height: 30px;

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 2;
  cursor: pointer;
  outline: none;

  border-radius: 24px;
  border: 4px solid #191919;
  background: #292929;

  svg {
    position: absolute;
  }
`;
