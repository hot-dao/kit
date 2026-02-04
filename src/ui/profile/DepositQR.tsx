import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { WarningIcon } from "../icons/warning";
import CopyIcon from "../icons/copy";

import { HotKit } from "../../HotKit";
import { BridgeReview } from "../../core/exchange";
import { ActionButton, Button } from "../uikit/button";
import { PMedium, PSmall } from "../uikit/text";

const DepositQR = observer(({ kit, review, onConfirm, onCancel }: { kit: HotKit; review: BridgeReview; onConfirm: () => void; onCancel?: () => void }) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling | null>(() => {
    if (review.qoute === "deposit" || review.qoute === "withdraw") return null;
    return new QRCodeStyling({
      data: review.qoute.depositAddress,
      dotsOptions: { color: "#eeeeee", type: "dots" },
      backgroundOptions: { color: "transparent" },
      shape: "square",
      width: 180,
      height: 180,
      type: "svg",
    });
  });

  useEffect(() => {
    if (!qrCodeRef.current) return;
    if (review.qoute === "deposit" || review.qoute === "withdraw") return;
    qrCode?.append(qrCodeRef.current);
  }, []);

  if (review.qoute === "deposit" || review.qoute === "withdraw") return null;
  const depositAddress = review.qoute.depositAddress as string;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(depositAddress);
      kit.toast.success("Address copied to clipboard");
    } catch (error) {
      kit.toast.failed("Failed to copy address");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", gap: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      {onCancel != null && (
        <CloseButton onClick={onCancel}>
          <PSmall>Back</PSmall>
        </CloseButton>
      )}

      <div ref={qrCodeRef} style={{ marginTop: "auto", borderRadius: 12, padding: "4px 4px 0 4px", border: "1px solid #2d2d2d", background: "#1c1c1c", textAlign: "left" }}></div>

      <PMedium style={{ textAlign: "center", marginTop: 16, color: "#ababab", width: "100%" }}>
        Send <Pre>{review.qoute.amountInFormatted}</Pre> <Pre>{review.from.symbol}</Pre> on <Pre>{review.from.chainName}</Pre> chain to:
      </PMedium>

      <div style={{ width: "100%", display: "flex", gap: 4, marginBottom: "auto" }}>
        <Pre style={{ textAlign: "center", fontSize: 14, fontWeight: "bold", padding: 0, background: "transparent", border: "none" }}>{depositAddress}</Pre>
        <Button style={{ height: 20 }} onClick={handleCopy}>
          <CopyIcon width={20} height={20} color="#ababab" />
        </Button>
      </div>

      <WarningBadge>
        <WarningIcon color="#F3AE47" style={{ marginTop: 4, flexShrink: 0 }} />
        <PSmall style={{ color: "#F3AE47", fontWeight: "bold" }}>
          Only deposit {review.from.symbol} from {review.from.chainName} network.
          <br />
          Depositing other assets or using a different network will result in loss of funds
        </PSmall>
      </WarningBadge>

      <ActionButton style={{ marginTop: 12 }} onClick={onConfirm}>
        I sent the funds
      </ActionButton>
    </div>
  );
});

const WarningBadge = styled.div`
  border-radius: 8px;
  border: 1px solid var(--border-border-orange, #f3ae47);
  background: var(--surface-warning, #3f311d);
  padding: 8px;
  display: flex;
  gap: 8px;
  text-align: left;
  margin-top: 12px;
`;

const Pre = styled.code`
  display: inline;
  background: #2d2d2d;
  padding: 0 2px;
  border-radius: 4px;
  border: 1px solid #ffffff14;
  word-break: break-all;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-align: left;
  margin: 0;
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: 2px;
  left: 2px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff14;
  background: #2d2d2d;
`;

export default DepositQR;
