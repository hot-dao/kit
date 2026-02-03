import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { BridgeReview } from "../../core/exchange";
import { formatter } from "../../core";

import { ActionButton, Button } from "../uikit/button";
import { PMedium, PSmall } from "../uikit/text";

const DepositQR = observer(({ review, onConfirm, onCancel }: { review: BridgeReview; onConfirm: () => void; onCancel: () => void }) => {
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", gap: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <CloseButton onClick={onCancel}>
        <PSmall>Back</PSmall>
      </CloseButton>

      <div ref={qrCodeRef} style={{ marginTop: "auto", borderRadius: 12, padding: 8, border: "1px solid #2d2d2d", background: "#1c1c1c", textAlign: "left" }}></div>

      <PMedium style={{ marginTop: 16, color: "#ababab", textAlign: "left", width: "100%" }}>
        Send <Pre>{review.qoute.amountInFormatted}</Pre> <Pre>{review.from.symbol}</Pre> on <Pre>{review.from.chainName}</Pre> chain to:
      </PMedium>

      <Pre style={{ width: "100%", fontSize: 14, fontWeight: "bold", textAlign: "left", padding: 0, background: "transparent", border: "none" }}>{review.qoute.depositAddress}</Pre>

      <PSmall style={{ marginTop: 12, color: "#ababab", textAlign: "left" }}>
        Please make sure you send <Pre>{review.from.symbol}</Pre> token on <Pre>{review.from.chainName}</Pre> chain, otherwise you may lose your funds!
      </PSmall>

      <PSmall style={{ color: "#ababab", textAlign: "left" }}>
        If the exchange fails, your funds will be refunded on your HEX balance to <Pre>{formatter.truncateAddress(review.refund?.address || "", 12)}</Pre> after 20 minutes and you will be able to withdraw or exchange them.
      </PSmall>

      <ActionButton style={{ marginTop: 12 }} onClick={onConfirm}>
        I sent the funds
      </ActionButton>
    </div>
  );
});

const Pre = styled.pre`
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
