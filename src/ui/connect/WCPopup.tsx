import React, { useEffect, useRef, useState } from "react";
import QRCode, { darkQR } from "../qrcode";
import Popup, { present } from "../Popup";

interface WalletConnectPopupProps {
  uri: string;
  onReject: () => void;
  onUpdateUriRef?: (setUri: (uri: string) => void) => void;
}

const WalletConnectPopupComponent: React.FC<WalletConnectPopupProps> = ({ uri: initialUri, onReject, onUpdateUriRef }) => {
  const [uri, setUri] = useState(initialUri);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [copyText, setCopyText] = useState("Copy Link");
  const qrCodeInstanceRef = useRef<QRCode | null>(null);

  useEffect(() => {
    onUpdateUriRef?.(setUri);
  }, [onUpdateUriRef]);

  useEffect(() => {
    if (!uri || uri === "LOADING" || !qrCodeRef.current) return;

    const size = 215;
    const img = new Image();
    img.src = "https://storage.herewallet.app/upload/2470b14a81fcf84e7cb53230311a7289b96a49ab880c7fa7a22765d7cdeb1271.svg";

    // Clear previous QR code
    if (qrCodeInstanceRef.current) {
      qrCodeInstanceRef.current.stopAnimate();
    }

    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = "";
    }

    const qrcode = new QRCode({
      ...darkQR,
      size: size,
      value: uri,
      ecLevel: "H",
      imageEcCover: 0.2,
      logo: img,
      fill: {
        type: "linear-gradient",
        position: [0, 0, 1, 1],
        colorStops: [
          [0, "#fff"],
          [1, "#fff"],
        ],
      },
    });

    qrCodeInstanceRef.current = qrcode;
    if (qrCodeRef.current) {
      qrCodeRef.current.appendChild(qrcode.canvas);
    }
  }, [uri]);

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
        {uri && uri !== "LOADING" ? (
          <div ref={qrCodeRef} className="qr-code" style={{ display: "flex", justifyContent: "center" }}></div>
        ) : (
          <div style={{ width: 215, height: 215, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <p>Loading...</p>
          </div>
        )}
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
};

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
    present<void>((resolvePopup, rejectPopup) => {
      this.resolve = () => resolvePopup();
      this.reject = () => rejectPopup(new Error("User rejected"));

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
    }).catch(() => {
      // Ignore errors from user rejection
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
