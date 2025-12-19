import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { WalletIcon } from "../icons/wallet";
import { PopupButton, PopupOption, PopupOptionInfo } from "../styles";
import { Commitment, Intents } from "../../core";
import { Recipient } from "../../core/recipient";
import { Token } from "../../core/token";

import { BridgeReview } from "../../exchange";
import { openConnector } from "../router";

import { OmniWallet } from "../../OmniWallet";
import { HotConnector } from "../../HotConnector";
import Popup from "../Popup";

import { TokenCard } from "./TokenCard";
import { HorizontalStepper } from "./Stepper";
import { Loader } from "./Profile";

interface PaymentProps {
  intents: Intents;
  title?: string;
  allowedTokens?: string[];
  prepaidAmount: bigint;
  payableToken: Token;
  needAmount: bigint;
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

const serializeError = (error: any) => {
  try {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && Object.keys(error).length > 0) return JSON.stringify(error);
    if (typeof error === "string" || typeof error === "number") return error.toString();
    return "";
  } catch (error) {
    return "Unknown error";
  }
};

export const Payment = observer(({ connector, intents, title = "Payment", allowedTokens, prepaidAmount, payableToken, needAmount, onReject, onConfirm }: PaymentProps) => {
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
  } | null>(needAmount === 0n ? { step: "sign", review: "direct" } : null);

  const paymentTitle = title || `Pay ${payableToken.readable(needAmount)} ${payableToken.symbol}`;

  const selectToken = async (from: Token, wallet?: OmniWallet) => {
    if (!wallet) return;

    try {
      setFlow({ token: from, wallet, review: undefined, step: "sign" });
      const review = await connector.exchange.reviewSwap({
        recipient: Recipient.fromWallet(intents.signer)!,
        amount: needAmount + (needAmount * BigInt(Math.floor(PAY_SLIPPAGE * 1000))) / BigInt(1000),
        slippage: PAY_SLIPPAGE,
        sender: wallet,
        refund: wallet,
        type: "exactOut",
        to: payableToken,
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
      setFlow({ loading: false, step: "success", success: { depositQoute: result.review, processing: result.processing } });
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
        <PopupButton style={{ marginTop: "auto" }} onClick={() => onConfirm(flow.success!)}>
          Continue
        </PopupButton>
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
          <p style={{ fontSize: 14, width: "80%", textAlign: "center", overflowY: "auto", lineBreak: "anywhere" }}>{serializeError(flow.error)}</p>
        </div>
        <PopupButton onClick={() => onReject(serializeError(flow.error))}>Close</PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "transfer") {
    return (
      <Popup onClose={() => onReject("closed")} header={<p>{paymentTitle}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={2} />

        {prepaidAmount > 0n && <TokenCard token={payableToken} hot={connector} wallet={intents.signer} amount={prepaidAmount} />}

        {flow.token != null && (
          <TokenCard //
            hot={connector}
            token={flow.token}
            wallet={flow.wallet}
            amount={flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0n}
          />
        )}

        <PopupButton style={{ marginTop: 24 }} disabled={!flow?.review} onClick={confirmPaymentStep}>
          {flow?.loading ? "Confirming..." : "Confirm transaction"}
        </PopupButton>
      </Popup>
    );
  }

  if (flow?.step === "sign") {
    const rightControl = <div style={{ paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>{flow.error ? <ErrorIcon /> : <Loader />}</div>;

    return (
      <Popup onClose={() => onReject("closed")} header={<p>{title}</p>}>
        <HorizontalStepper steps={[{ label: "Select" }, { label: "Review" }, { label: "Confirm" }]} currentStep={1} />

        {prepaidAmount > 0n && <TokenCard token={payableToken} hot={connector} wallet={intents.signer} amount={prepaidAmount} />}

        {flow.token != null && (
          <TokenCard //
            hot={connector}
            token={flow.token}
            wallet={flow.wallet}
            rightControl={flow.review ? undefined : rightControl}
            amount={flow.review === "direct" ? needAmount : flow.review?.amountIn ?? 0n}
          />
        )}

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
        if (token.id === payableToken.id) return null;
        const availableBalance = token.float(balance) - token.reserve;

        // Allow only tokens in the allowedTokens list
        if (allowedTokens != null && !allowedTokens?.includes(token.omniAddress)) return null;

        // same token as need and enough balance is direct deposit
        if (token.originalChain === payableToken.originalChain && token.originalAddress === payableToken.originalAddress && availableBalance >= payableToken.float(needAmount)) {
          return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
        }

        if (availableBalance * token.usd <= payableToken.usd * payableToken.float(needAmount) * (1 + PAY_SLIPPAGE)) return null;
        return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
      })}
      <PopupOption onClick={() => openConnector(connector)}>
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
