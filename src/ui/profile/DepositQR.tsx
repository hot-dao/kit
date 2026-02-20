import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { WarningIcon } from "../icons/warning";
import CopyIcon from "../icons/copy";

import { HotKit } from "../../HotKit";
import { ActionButton, Button } from "../uikit/button";
import { PLarge, PMedium, PSmall, PTiny } from "../uikit/text";
import { Token } from "../../core/token";
import { WarningBox } from "../uikit/badge";
import uuid4 from "uuid4";

export const QRAnimation = ({ size = 180 }: { size?: number }) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling | null>(() => {
    return new QRCodeStyling({
      data: uuid4().slice(0, 6),
      dotsOptions: { color: "#eeeeee73", type: "dots" },
      backgroundOptions: { color: "transparent" },
      shape: "square",
      width: window.innerWidth < 760 ? size * 0.7 : size,
      height: window.innerWidth < 760 ? size * 0.7 : size,
      type: "svg",
    });
  });

  useEffect(() => {
    if (!qrCodeRef.current) return;
    qrCode?.append(qrCodeRef.current);

    const interval = setInterval(() => {
      qrCode?.update({ data: uuid4().slice(0, 6) });
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return <div ref={qrCodeRef} style={{ borderRadius: 12, padding: "4px 4px 0 4px", border: "1px solid #2d2d2d", background: "#1c1c1c" }}></div>;
};

const DepositQR = observer(
  ({
    kit,
    token,
    depositAmount,
    minimumAmount,
    depositAddress,
    memo,
    onConfirm,
    onCancel,
  }: {
    kit: HotKit;
    token: Token;
    memo?: string;
    depositAmount?: string;
    minimumAmount?: number;
    depositAddress: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    const qrCodeRef = useRef<HTMLDivElement>(null);
    const [qrCode] = useState<QRCodeStyling | null>(() => {
      return new QRCodeStyling({
        data: depositAddress,
        dotsOptions: { color: "#eeeeee", type: "dots" },
        backgroundOptions: { color: "transparent" },
        shape: "square",
        width: 140,
        height: 140,
        type: "svg",
      });
    });

    useEffect(() => {
      if (!qrCodeRef.current) return;
      qrCode?.append(qrCodeRef.current);
    }, []);

    const handleCopy = async (value: string, label?: string) => {
      try {
        await navigator.clipboard.writeText(value);
        kit.toast.success(label != null ? `${label} copied to clipboard` : "Value copied to clipboard");
      } catch (error) {
        kit.toast.failed(label != null ? `Failed to copy ${label}` : "Failed to copy value");
      }
    };

    return (
      <div style={{ position: "relative", width: "100%", height: "100%", gap: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
        {onCancel != null && (
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", height: 32 }}>
            <CloseButton onClick={onCancel}>
              <PSmall>Back</PSmall>
            </CloseButton>
            <PLarge>Exchange via QR</PLarge>
          </div>
        )}

        <div style={{ width: "100%", display: "flex", gap: 4 }}>
          <div>
            <QRContainer ref={qrCodeRef} />
          </div>

          <Card>
            <Row style={{ background: "#1c1c1c", flexDirection: "column", textAlign: "left", alignItems: "flex-start" }}>
              <PSmall style={{ color: "#d4d4d4" }}>Deposit address</PSmall>
              <PSmall style={{ marginTop: 4, fontWeight: 600, fontFamily: "monospace", textAlign: "left" }}>
                {depositAddress}
                <Button style={{ marginLeft: 4, display: "inline-block", verticalAlign: "bottom", flexShrink: 0, width: 20, height: 20 }} onClick={() => handleCopy(depositAddress, "Address")}>
                  <CopyIcon width={20} height={20} color="#ababab" />
                </Button>
              </PSmall>
            </Row>

            {minimumAmount != null && (
              <Row>
                <PSmall>Minimum deposit</PSmall>
                <PMedium>
                  {token.readable(minimumAmount)} {token.symbol}
                </PMedium>
              </Row>
            )}

            {depositAmount != null && (
              <>
                <Row>
                  <PSmall>Network</PSmall>
                  <PMedium>{token.chainName}</PMedium>
                </Row>

                <Row>
                  <PSmall>Token</PSmall>
                  <PMedium>{token.symbol}</PMedium>
                </Row>

                <Row>
                  <PSmall>Required transfer</PSmall>
                  <PMedium>
                    {depositAmount}
                    <Button style={{ marginLeft: 4, display: "inline-block", verticalAlign: "bottom", flexShrink: 0, width: 20, height: 20 }} onClick={() => handleCopy(depositAmount, "Amount")}>
                      <CopyIcon width={20} height={20} color="#ababab" />
                    </Button>
                  </PMedium>
                </Row>
              </>
            )}

            {memo != null && (
              <Row>
                <PSmall style={{ fontWeight: 600 }}>Required memo</PSmall>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <PMedium style={{ fontWeight: 600, color: "#f3ae47" }}>{memo}</PMedium>
                  <Button style={{ flexShrink: 0, marginTop: 2 }} onClick={() => handleCopy(memo, "Memo")}>
                    <CopyIcon width={20} height={20} color="#ababab" />
                  </Button>
                </div>
              </Row>
            )}
          </Card>
        </div>

        <WarningBox type="warning" style={{ marginTop: "auto" }}>
          Only deposit {token.symbol} from {token.chainName} network{memo != null ? ` with memo "${memo}"` : ""}, otherwise funds will be lost!
        </WarningBox>

        <ActionButton style={{ marginTop: 8 }} onClick={onConfirm}>
          I sent the funds
        </ActionButton>
      </div>
    );
  }
);

const Card = styled.div`
  border-radius: 8px;
  border: 1px solid #323232;
  background: #1f1f1f;
  overflow: hidden;
  height: fit-content;

  width: 100%;
  display: flex;
  flex-direction: column;
  margin-top: 12px;

  p {
    text-align: left;
    word-break: break-all;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    color: #fff;
  }
`;

const Row = styled.div`
  padding: 8px 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  position: relative;

  > *:first-child {
    margin-right: 12px;
  }

  & + & {
    border-top: 1px solid #323232;
  }
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

const QRContainer = styled.div`
  margin-top: 12px;
  border-radius: 12px;
  border: 1px solid #2d2d2d;
  background: #1c1c1c;
  text-align: left;

  @media (max-width: 760px) {
    display: none;
  }
`;

export default DepositQR;
