import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { WalletIcon } from "../icons/wallet";
import { PopupButton, PopupOption, PopupOptionInfo } from "../styles";
import { Commitment, formatter, Intents } from "../../core";
import { Recipient } from "../../core/recipient";
import { Network } from "../../core/chains";
import { Token } from "../../core/token";

import { BridgeReview } from "../../exchange";
import { openConnector } from "../router";

import { OmniWallet } from "../../OmniWallet";
import { HotConnector } from "../../HotConnector";
import Popup from "../Popup";

import { TokenCard, TokenIcon } from "./TokenCard";
import { HorizontalStepper } from "./Stepper";
import { Loader } from "./Profile";

interface PaymentProps {
  intents: Intents;
  connector: HotConnector;
  onReject: (message: string) => void;
  onConfirm: (args: { depositQoute: BridgeReview | "direct"; processing?: () => Promise<BridgeReview> }) => void;
}

const animations = {
  success: "https://hex.exchange/success.json",
  failed: "https://hex.exchange/error.json",
  loading: "https://hex.exchange/loading.json",
};

const PAY_SLIPPAGE = 0.002;

export const Payment = observer(({ connector, intents, onReject, onConfirm }: PaymentProps) => {
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
    review?: BridgeReview | "direct";
    success?: { depositQoute: BridgeReview | "direct"; processing?: () => Promise<BridgeReview> };
    step?: "selectToken" | "sign" | "transfer" | "success" | "error" | "loading";
    loading?: boolean;
    error?: any;
  } | null>(null);

  const need = connector.omni(intents.need.keys().next().value!);
  const needAmount = intents.need.values().next().value || 0n;
  const title = `Payment ${need.readable(needAmount)} ${need.symbol}`;

  const selectToken = async (from: Token, wallet?: OmniWallet) => {
    if (!wallet) return;

    // Set signer as payer wallet if not set another
    if (!intents.signer) intents.attachWallet(wallet);

    if (from.id === need.id) {
      return setFlow({ token: from, wallet, review: "direct", step: "sign" });
    }

    try {
      setFlow({ token: from, wallet, review: undefined, step: "sign" });
      const review = await connector.exchange.reviewSwap({
        recipient: Recipient.fromWallet(intents.signer)!,
        amount: needAmount + (needAmount * BigInt(Math.floor(PAY_SLIPPAGE * 1000))) / BigInt(1000),
        slippage: PAY_SLIPPAGE,
        sender: wallet,
        refund: wallet,
        type: "exactOut",
        to: need,
        from,
      });

      setFlow({ token: from, wallet, review, step: "sign" });
    } catch {
      setFlow({ token: from, wallet, error: true, step: "sign" });
    }
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
      if (!flow?.review) throw new Error("Review not found");
      setFlow((t) => (t ? { ...t, step: "loading" } : null));

      if (flow.review == "direct") {
        return setFlow({ step: "success", loading: false, success: { depositQoute: "direct" } });
      }

      const result = await connector.exchange.makeSwap(flow.review, { log: () => {} });
      setFlow({
        loading: false,
        step: "success",
        success: { depositQoute: result.review, processing: result.processing },
      });
    } catch (error) {
      console.error(error);
      setFlow((t) => (t ? { ...t, step: "error", loading: false, error } : null));
      throw error;
    }
  };

  if (flow?.step === "success") {
    return (
      <Popup header={<p>{title}</p>}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="success" src={animations.success} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Payment successful</p>
        </div>
        <PopupButton style={{ marginTop: "auto" }} onClick={() => onConfirm(flow.success!)}>
          Continue
        </PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "loading") {
    return (
      <Popup header={<p>{title}</p>}>
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
      <Popup header={<p>{title}</p>}>
        <div style={{ width: "100%", height: 400, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-expect-error: dotlottie-wc is not typed */}
          <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ fontSize: 24, marginTop: -32, fontWeight: "bold" }}>Payment failed</p>
          <p style={{ fontSize: 14, width: "80%", textAlign: "center", overflowY: "auto", lineBreak: "anywhere" }}>{flow.error?.toString?.() ?? "Unknown error"}</p>
        </div>
        <PopupButton onClick={() => onReject(flow.error?.toString?.() ?? "Unknown error")}>Close</PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "transfer") {
    if (!flow.token) return null;
    if (!flow.wallet) return null;
    return (
      <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={2} />

        <PopupOption style={{ marginTop: 8 }}>
          <TokenIcon token={flow.token} wallet={flow.wallet} />

          <div style={{ marginTop: -2, textAlign: "left" }}>
            <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{flow.token.symbol}</p>
            <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(flow.token.usd)}</p>
          </div>

          {flow.review ? (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <p style={{ textAlign: "right", fontSize: 20 }}>{flow.token.readable(flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0)}</p>
              <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${flow.token.readable(flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0n, flow.token.usd)}</p>
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
      <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={1} />

        <PopupOption style={{ marginTop: 8 }}>
          <TokenIcon token={flow.token} wallet={flow.wallet} />

          <div style={{ marginTop: -2, textAlign: "left" }}>
            <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{flow.token.symbol}</p>
            <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(flow.token.usd)}</p>
          </div>

          {flow.review ? (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              <p style={{ textAlign: "right", fontSize: 20 }}>{flow.token.readable(flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0)}</p>
              <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${flow.token.readable(flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0n, flow.token.usd)}</p>
            </div>
          ) : (
            <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
              {flow.error ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Failed" style={{ display: "block", margin: "0 auto" }}>
                  <circle cx="14" cy="14" r="13" stroke="#E74C3C" strokeWidth="2" />
                  <path d="M9 9l10 10M19 9l-10 10" stroke="#E74C3C" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <Loader />
              )}
            </div>
          )}
        </PopupOption>

        {flow.error ? (
          <PopupButton style={{ marginTop: 24 }} onClick={() => setFlow(null)}>
            Select another token
          </PopupButton>
        ) : (
          <PopupButton style={{ marginTop: 24 }} disabled={!flow?.review} onClick={signStep}>
            {flow?.loading ? "Signing..." : flow?.review ? "Sign review" : "Quoting..."}
          </PopupButton>
        )}
      </Popup>
    );
  }

  return (
    <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
      <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={0} />

      {connector.walletsTokens.map(({ token, wallet, balance }) => {
        const availableBalance = token.float(balance) - token.reserve;

        if (need.originalChain === Network.Gonka || need.originalChain === Network.Juno) {
          if (token.id === need.id) return null;
          if (token.originalAddress !== need.originalAddress) return null;
          if (availableBalance < need.float(needAmount)) return null;
          return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
        }

        if (availableBalance * token.usd <= need.usd * need.float(needAmount) * (1 + PAY_SLIPPAGE)) return null;
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
