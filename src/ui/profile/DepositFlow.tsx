import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { Token } from "../../core/token";
import { OmniWallet } from "../../core/OmniWallet";
import { chains, Network, OmniToken } from "../../core/chains";
import { Recipient } from "../../core/recipient";
import { formatter } from "../../core/utils";
import { tokens } from "../../core/tokens";

import SegmentedControl from "../uikit/tabs";
import { useAnimations } from "../uikit/animationts";
import { ActionButton, Button } from "../uikit/button";
import { H5, PMedium, PSmall, PTiny } from "../uikit/text";
import { WarningBox } from "../uikit/badge";
import { ImageView } from "../uikit/image";

import Popup from "../Popup";
import { HotKit } from "../../HotKit";
import { ArrowRightIcon } from "../icons/arrow-right";
import { TokenAmountCard } from "../bridge/TokenAmountCard";
import DepositQR, { QRAnimation } from "./DepositQR";

interface DepositFlowProps {
  kit: HotKit;
  onClose: () => void;
  initialToken?: Token;
  widget?: boolean;
}

export const DepositFlow: React.FC<DepositFlowProps> = observer(({ kit, initialToken, onClose, widget }) => {
  const [type, setType] = useState<"external" | "connected">("external");

  const [token, setToken] = useState<Token | null>(initialToken ?? null);
  const [state, setState] = useState<"loading" | "success" | "error" | null>(null);
  const [sender, setSender] = useState<OmniWallet | undefined>(kit.wallets.find((w) => w.type === token?.type));
  const animations = useAnimations();

  const availableChainsToConnect = Array.from(new Set(kit.connectors.flatMap((c) => c.walletTypes)));

  const [depositQoute, setDepositQoute] = useState<{
    execute: (sender: OmniWallet, amount: bigint) => Promise<void>;
    depositAddress?: string;
    minAmount: number;
    memo?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isFiat, setIsFiat] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>("0");

  const [recipient, setRecipient] = useState<Recipient | undefined>(() => {
    if (kit.priorityWallet == null) return;
    return Recipient.fromWallet(kit.priorityWallet);
  });

  useEffect(() => {
    setError(null);
    setDepositQoute(null);
    if (token == null || recipient == null) return;
    kit.exchange
      .getDepositQoute(token, recipient)
      .then((qoute) => setDepositQoute(qoute))
      .catch((error) => {
        setError(error?.toString?.() || "Failed to get deposit address");
        setDepositQoute(null);
        console.error(error);
      });
  }, [token, recipient]);

  useEffect(() => {
    if (token?.omniAddress === OmniToken.GONKA) setType("connected");
  }, [token]);

  if (type === "connected") {
    const amountInTokens = isFiat ? +formatter.fromInput(amount) / (token?.usd || 0) : +formatter.fromInput(amount);
    const availableBalance = token != null ? +Math.max(0, token.float(kit.balance(sender, token)) - token.reserve).toFixed(4) : 0;
    const minimumAmount = token?.float(depositQoute?.minAmount ?? 0) ?? 0;
    const isDisabled = amountInTokens <= 0 || amountInTokens > availableBalance || depositQoute == null || minimumAmount > amountInTokens;

    const handleDeposit = async () => {
      setState("loading");
      try {
        if (!token) throw new Error("No token selected");
        if (!sender) throw new Error("No sender selected");
        if (!depositQoute) throw new Error("No deposit qoute found");
        await depositQoute.execute(sender, token.int(amountInTokens));
        setState("success");
      } catch (error) {
        console.error(error);
        setError(error?.toString?.() || "Failed to deposit");
        setState("error");
      }
    };

    if (state === "loading") {
      return (
        <Popup widget={widget} header={<p>Deposit to HEX</p>} onClose={onClose}>
          <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            {/* @ts-expect-error: dotlottie-wc is not typed */}
            <dotlottie-wc key="loading" src={animations.loading} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
            <H5 style={{ marginTop: -32 }}>Deposit in progress</H5>
          </div>
        </Popup>
      );
    }

    if (state === "success") {
      return (
        <Popup widget={widget} header={<p>Deposit to HEX</p>} onClose={onClose}>
          <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            {/* @ts-expect-error: dotlottie-wc is not typed */}
            <dotlottie-wc key="success" src={animations.success} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
            <H5 style={{ marginTop: -32 }}>Deposit in progress</H5>
            <PSmall style={{ marginTop: 8 }}>You can track your transaction in the activity</PSmall>
          </div>
          <ActionButton style={{ marginTop: "auto" }} onClick={() => onClose()}>
            Continue
          </ActionButton>
        </Popup>
      );
    }

    if (state === "error") {
      return (
        <Popup widget={widget} header={<p>Deposit to HEX</p>} onClose={onClose}>
          <div style={{ width: "100%", height: 400, marginBottom: 8, gap: 8, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
            {/* @ts-expect-error: dotlottie-wc is not typed */}
            <dotlottie-wc key="error" src={animations.failed} speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
            <H5 style={{ marginTop: -32 }}>Deposit failed</H5>
            <TextField>{error}</TextField>
          </div>

          <ActionButton style={{ marginTop: "auto" }} onClick={() => onClose()}>
            Continue
          </ActionButton>
        </Popup>
      );
    }

    return (
      <Popup height={600} widget={widget} header={<p>Deposit to HEX</p>} onClose={onClose}>
        <SegmentedControl
          value={type}
          onChange={(value) => setType(value as "external" | "connected")}
          options={[
            { label: "External wallet", value: "external", background: "#161616" },
            { label: "Connected wallet", value: "connected", background: "#161616" },
          ]}
        />

        <Card onClick={() => kit.router.openSelectRecipient({ kit, chain: Network.Omni, onSelect: (r) => setRecipient(r) })}>
          <ImageView src={chains.get(Network.Omni)?.logo || ""} alt="HEX Wallet" size={24} />
          {recipient == null && <PSmall>Choose receiver</PSmall>}
          {recipient != null && (
            <PSmall>
              Deposit to <b style={{ color: "#b4b4b4" }}>{formatter.truncateAddress(recipient.address)}</b>
            </PSmall>
          )}

          <ArrowRightIcon style={{ transform: "rotate(90deg)", marginLeft: "auto" }} />
        </Card>

        <TokenAmountCard
          kit={kit}
          disableQR
          sender={sender}
          isFiat={isFiat}
          isReviewing={false}
          amount={amountInTokens}
          token={token ?? undefined}
          availableBalance={availableBalance}
          readableAmount={formatter.fromInput(amount)}
          disableChains={[Network.Omni, Network.HotCraft].concat(tokens.list.filter((t) => !availableChainsToConnect.includes(t.type)).map((t) => t.chain))}
          style={{ marginTop: 12, borderRadius: "20px 20px", overflow: "hidden", marginBottom: 8 }}
          setSender={(sender) => setSender(sender as OmniWallet)}
          handleMax={() => setAmount(String(isFiat ? availableBalance * (token?.usd || 0) : availableBalance))}
          setValue={setAmount}
          setIsFiat={setIsFiat}
          setToken={setToken}
        />

        {minimumAmount > 0 && (
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <PSmall>Minimum deposit:</PSmall>
            <PSmall>
              {formatter.amount(minimumAmount)} {token?.symbol}
            </PSmall>
          </div>
        )}

        <ActionButton style={{ marginTop: "auto" }} disabled={isDisabled} onClick={handleDeposit}>
          Deposit
        </ActionButton>
      </Popup>
    );
  }

  return (
    <Popup height={670} widget={widget} header={<p>Deposit to HEX</p>} onClose={onClose}>
      <SegmentedControl
        options={[
          { label: "External wallet", value: "external", background: "#161616" },
          { label: "Connected wallet", value: "connected", background: "#161616" },
        ]}
        onChange={(value) => setType(value as "external" | "connected")}
        value={type}
      />

      <Card onClick={() => kit.router.openSelectTokenPopup({ kit, disableChains: [Network.Omni, Network.HotCraft], onSelect: (t) => setToken(t) })}>
        <ImageView src={token?.icon || ""} alt={token?.symbol || ""} size={24} />
        {token == null && <PSmall>Choose token</PSmall>}
        {token != null && (
          <PSmall>
            {token.symbol} ({token.chainName})
          </PSmall>
        )}
        <ArrowRightIcon style={{ transform: "rotate(90deg)", marginLeft: "auto" }} />
      </Card>

      <Card onClick={() => kit.router.openSelectRecipient({ kit, chain: Network.Omni, onSelect: (r) => setRecipient(r) })}>
        <ImageView src={chains.get(Network.Omni)?.logo || ""} alt="HEX Wallet" size={24} />
        {recipient == null && <PSmall>Choose receiver</PSmall>}
        {recipient != null && (
          <PSmall>
            Deposit to <b style={{ color: "#b4b4b4" }}>{formatter.truncateAddress(recipient.address)}</b>
          </PSmall>
        )}
        <ArrowRightIcon style={{ transform: "rotate(90deg)", marginLeft: "auto" }} />
      </Card>

      {depositQoute?.depositAddress != null && token != null && (
        <DepositQR //
          kit={kit}
          token={token}
          memo={depositQoute.memo}
          minimumAmount={token?.float(depositQoute.minAmount)}
          depositAddress={depositQoute.depositAddress}
          onConfirm={() => {
            setError(null);
            setDepositQoute(null);
            onClose();
          }}
        />
      )}

      {(depositQoute?.depositAddress == null || token == null) && (
        <div style={{ width: "100%", height: "100%", minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <QRAnimation />
          {depositQoute == null && <PMedium style={{ marginTop: 12, opacity: 0.5 }}>Calculating deposit address</PMedium>}
          {depositQoute != null && (
            <PMedium style={{ marginTop: 16, opacity: 0.5 }}>
              {token?.symbol} token does not support
              <br />
              deposits via QR code. Try to deposit from a connected wallet.
            </PMedium>
          )}
        </div>
      )}

      {error != null && (
        <WarningBox style={{ marginTop: 8 }} type="error">
          {error}
        </WarningBox>
      )}
    </Popup>
  );
});

const Card = styled(Button)`
  border-radius: 12px;
  border: 1px solid #323232;
  background: #1f1f1f;
  display: flex;
  padding: 8px;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  cursor: pointer;
  margin-top: 4px;
  transition: background 0.2s ease-in-out;

  &:hover {
    background: #272727;
    opacity: 1;
  }
`;

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
