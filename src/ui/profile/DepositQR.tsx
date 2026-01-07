import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { BridgeReview } from "../../exchange";
import { PopupButton } from "../styles";

const DepositQR = observer(({ review, onConfirm, onCancel }: { review: BridgeReview; onConfirm: () => void; onCancel: () => void }) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling | null>(() => {
    if (review.qoute === "deposit" || review.qoute === "withdraw") return null;
    return new QRCodeStyling({
      data: review.qoute.depositAddress,
      dotsOptions: { color: "#eeeeee", type: "rounded" },
      backgroundOptions: { color: "transparent" },
      shape: "circle",
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
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <CloseButton onClick={onCancel} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="#2d2d2d" strokeWidth="2" fill="#181818" />
          <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </CloseButton>

      <div
        ref={qrCodeRef}
        style={{
          marginTop: "auto",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          paddingTop: 10,
          paddingLeft: 10,
          border: "1px solid #2d2d2d",
          background: "#1c1c1c",
        }}
      ></div>

      <p style={{ marginTop: 24 }}>
        Send{" "}
        <b>
          {review.qoute.amountInFormatted} {review.from.symbol}
        </b>{" "}
        on <b>{review.from.chainName}</b> to
      </p>

      <div style={{ width: "100%", marginTop: 8, padding: 12, marginBottom: 24, border: "1px solid #2d2d2d", borderRadius: 12, background: "#1c1c1c" }}>
        <p style={{ wordBreak: "break-all" }}>{review.qoute.depositAddress}</p>
      </div>

      <PopupButton style={{ marginTop: "auto" }} onClick={onConfirm}>
        I sent the funds
      </PopupButton>
    </div>
  );
});

const CloseButton = styled.button`
  position: absolute;
  top: -8px;
  right: -12px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6;
  border-radius: 50%;
  transition: background 0.2s;
`;

export default DepositQR;
