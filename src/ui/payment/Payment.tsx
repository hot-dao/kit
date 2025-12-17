import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { Commitment, formatter, Intents } from "../../core";
import { Recipient } from "../../core/recipient";
import { Network } from "../../core/chains";
import { Token } from "../../core/token";
import { api } from "../../core/api";

import { BridgeReview } from "../../exchange";
import { openConnector } from "../router";

import { OmniWallet } from "../../OmniWallet";
import { HotConnector } from "../../HotConnector";
import Popup from "../Popup";

import { TokenCard, TokenIcon } from "./TokenCard";
import { PopupButton, PopupOption, PopupOptionInfo } from "../styles";
import { WalletIcon } from "../icons/wallet";
import { Loader } from "./Profile";

interface PaymentProps {
  intents: Intents;
  connector: HotConnector;
  onClose: () => void;
  onConfirm: (task: Promise<string>) => void;
}

import React from "react";

const animations = {
  success: "https://hex.exchange/success.json",
  failed: "https://hex.exchange/error.json",
  loading: "https://hex.exchange/loading.json",
};

interface Step {
  label: string;
  completed?: boolean;
  active?: boolean;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  style?: React.CSSProperties;
}

export const HorizontalStepper: React.FC<StepperProps> = ({ steps, currentStep, style }) => {
  return (
    <div style={{ padding: "0 32px 32px", display: "flex", alignItems: "center", width: "100%", margin: "16px 0", ...style }}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <React.Fragment key={idx}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  position: "relative",
                  borderRadius: "50%",
                  border: isActive || isCompleted ? "2px solid #ffffff" : "2px solid #a0a0a0",
                  background: isCompleted ? "#ffffff" : "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  zIndex: 1,
                }}
              >
                <p style={{ fontSize: 16, color: "#fff", opacity: isActive ? 1 : 0.5, position: "absolute", top: 24, width: 100 }}>{step.label}</p>
              </div>
            </div>

            {idx < steps.length - 1 && <div style={{ transition: "background 0.2s", flex: 1, height: 2, background: idx < currentStep ? "#ffffff" : "#333", margin: "0 6px", borderRadius: 24, minWidth: 24 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const Payment = observer(({ connector, intents, onClose, onConfirm }: PaymentProps) => {
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

    step?: "selectToken" | "sign" | "transfer" | "success" | "error" | "loading";
    success?: boolean;
    loading?: boolean;
    error?: any;
  } | null>(null);

  const need = connector.omni(intents.need.keys().next().value!);
  const needAmount = intents.need.values().next().value || 0n;
  const title = `Payment ${need.readable(needAmount)} ${need.symbol}`;

  const selectToken = async (from: Token, wallet?: OmniWallet) => {
    if (!wallet) return;

    setFlow({ token: from, wallet, review: undefined, step: "sign" });
    const review = await connector.exchange.reviewSwap({
      recipient: Recipient.fromWallet(wallet)!,
      amount: needAmount,
      sender: wallet,
      refund: wallet,
      slippage: 0.005,
      type: "exactOut",
      to: need,
      from,
    });

    setFlow({ token: from, wallet, review, step: "sign" });
  };

  const signStep = async () => {
    try {
      setFlow((t) => (t ? { ...t, step: "sign", loading: true } : null));
      const commitment = await intents.attachWallet(flow!.wallet!).sign();
      setFlow((t) => (t ? { ...t, step: "transfer", commitment, loading: false } : null));
    } catch (error) {
      console.error(error);
      setFlow((t) => (t ? { ...t, step: "error", loading: false, error } : null));
      throw error;
    }
  };

  const confirmPaymentStep = async () => {
    try {
      const commitment = flow?.commitment;
      if (!commitment) throw new Error("Commitment not found");
      if (!flow?.review) throw new Error("Review not found");

      setFlow((t) => (t ? { ...t, step: "loading" } : null));
      const result = await connector.exchange.makeSwap(flow.review, { log: () => {} });

      if (typeof result.review.qoute === "object") {
        await api.pendingPayment(commitment, result.review.qoute.depositAddress!);
      } else {
        await Intents.publish([commitment]);
      }

      setFlow((t) => (t ? { ...t, step: "success", loading: false, success: true } : null));
    } catch (error) {
      console.error(error);
      setFlow((t) => (t ? { ...t, step: "error", loading: false, error } : null));
      throw error;
    }
  };

  if (flow?.step === "success") {
    return (
      <Popup onClose={onClose} header={<p>{title}</p>}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="success" src={animations.success} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Payment successful</p>
        </div>
        <PopupButton style={{ marginTop: "auto" }} onClick={() => onClose()}>
          Continue
        </PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "loading") {
    return (
      <Popup onClose={onClose} header={<p>{title}</p>}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="loading" src={animations.loading} speed="1" style={{ marginTop: -64, width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -16, fontWeight: "bold" }}>Processing payment</p>
        </div>
      </Popup>
    );
  }

  if (flow?.step === "error") {
    return (
      <Popup onClose={onClose} header={<p>{title}</p>}>
        <div style={{ width: "100%", height: 400, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Payment failed</p>
          <p style={{ fontSize: 14 }}>{flow.error?.toString?.() ?? "Unknown error"}</p>
        </div>
        <PopupButton onClick={() => onClose()}>Close</PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "transfer") {
    if (!flow.token) return null;
    if (!flow.wallet) return null;
    return (
      <Popup onClose={onClose} header={<p>{title}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={2} />

        <PopupOption style={{ marginTop: 8 }}>
          <TokenIcon token={flow.token} wallet={flow.wallet} />

          <div style={{ marginTop: -2, textAlign: "left" }}>
            <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{flow.token.symbol}</p>
            <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(flow.token.usd)}</p>
          </div>

          {flow.review ? (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <p style={{ textAlign: "right", fontSize: 20 }}>{flow.token.readable(flow.review?.amountIn ?? 0)}</p>
              <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${flow.token.readable(flow.review?.amountIn ?? 0n, flow.token.usd)}</p>
            </div>
          ) : (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <Loader />
            </div>
          )}
        </PopupOption>

        <PopupButton style={{ marginTop: 24 }} disabled={!flow?.review} onClick={confirmPaymentStep}>
          {flow?.loading ? "Confirming..." : "Confirm payment"}
        </PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "sign") {
    if (!flow.token) return null;
    if (!flow.wallet) return null;
    return (
      <Popup onClose={onClose} header={<p>{title}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={1} />

        <PopupOption style={{ marginTop: 8 }}>
          <TokenIcon token={flow.token} wallet={flow.wallet} />

          <div style={{ marginTop: -2, textAlign: "left" }}>
            <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{flow.token.symbol}</p>
            <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(flow.token.usd)}</p>
          </div>

          {flow.review ? (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <p style={{ textAlign: "right", fontSize: 20 }}>{flow.token.readable(flow.review?.amountIn ?? 0)}</p>
              <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${flow.token.readable(flow.review?.amountIn ?? 0n, flow.token.usd)}</p>
            </div>
          ) : (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <Loader />
            </div>
          )}
        </PopupOption>

        <PopupButton style={{ marginTop: 24 }} disabled={!flow?.review} onClick={signStep}>
          {flow?.loading ? "Signing..." : flow?.review ? "Sign review" : "Quoting..."}
        </PopupButton>
      </Popup>
    );
  }

  return (
    <Popup onClose={onClose} header={<p>{title}</p>}>
      <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={0} />

      {connector.walletsTokens.map(({ token, wallet, balance }) => {
        if (token.id === need.id) return null;
        const availableBalance = token.float(balance) - token.reserve;

        if (need.originalChain === Network.Gonka || need.originalChain === Network.Juno) {
          if (token.id === need.id) return null;
          if (token.originalAddress !== need.originalAddress) return null;

          if (availableBalance < need.float(needAmount)) return null;
          return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
        }

        if (availableBalance * token.usd <= need.usd * need.float(needAmount)) return null;
        return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
      })}

      <PopupOption onClick={() => openConnector(connector)}>
        <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WalletIcon />
        </div>
        <PopupOptionInfo>
          <p>Connect wallet</p>
          <span className="wallet-address">To more pay options</span>
        </PopupOptionInfo>
      </PopupOption>
    </Popup>
  );
});
