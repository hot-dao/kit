import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import QRCodeStyling from "qr-code-styling";
import styled from "styled-components";

import Popup, { present } from "../Popup";

interface WalletConnectPopupProps {
  uri: string;
  onReject: () => void;
  onUpdateUriRef?: (setUri: (uri: string) => void) => void;
}

export const WalletConnectPopupComponent = observer(({ uri: initialUri, onReject, onUpdateUriRef }: WalletConnectPopupProps) => {
  const [uri, setUri] = useState(initialUri);
  const [copyText, setCopyText] = useState("Copy Link");
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling>(
    new QRCodeStyling({
      data: "",
      dotsOptions: { color: "#eeeeee", type: "rounded" },
      backgroundOptions: { color: "transparent" },
      shape: "square",
      width: 180,
      height: 180,
      type: "svg",
    })
  );

  useEffect(() => {
    qrCode.update({ data: uri });
  }, [onUpdateUriRef]);

  const handleCopy = async () => {
    if (uri && uri !== "LOADING") {
      await navigator.clipboard.writeText(uri);
      setCopyText("Link Copied");
      setTimeout(() => {
        setCopyText("Copy Link");
      }, 2000);
    }
  };

  return (
    <Popup onClose={onReject}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div ref={qrCodeRef} style={{ width: 200, height: 200 }}></div>
        <div className="copy-button" onClick={handleCopy} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-copy" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"
            ></path>
          </svg>
          <span>{copyText}</span>
        </div>
      </div>
    </Popup>
  );
});

export class WalletConnectPopup {
  private resolve: (() => void) | null = null;
  private reject: (() => void) | null = null;
  private currentUri: string;
  private updateUriFn: ((uri: string) => void) | null = null;

  constructor(
    readonly delegate: {
      uri: string;
      onReject: () => void;
    }
  ) {
    this.currentUri = delegate.uri;
  }

  create() {
    present((close) => {
      this.resolve = () => close();
      this.reject = () => close();

      return (
        <WalletConnectPopupComponent
          uri={this.currentUri}
          onReject={() => {
            this.delegate.onReject();
            this.reject?.();
          }}
          onUpdateUriRef={(setUri) => {
            this.updateUriFn = setUri;
          }}
        />
      );
    });
  }

  update(data: Partial<{ uri: string }>) {
    if (data.uri) {
      this.currentUri = data.uri;
      this.updateUriFn?.(data.uri);
    }
  }

  destroy() {
    this.reject?.();
  }
}

export const QrCode = styled.div`
  background: url("https://app.hot-labs.org/assets/QR.svg") center center / cover no-repeat;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  width: 400px;
  height: 400px;
  flex-shrink: 0;

  canvas {
    transform: translate(1px, 22px);
  }
`;

export const CopyButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s ease-in-out;
  background: #282c30;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin: auto;
  margin-top: -18px;

  &:hover {
    background: #383c40;
  }
`;
