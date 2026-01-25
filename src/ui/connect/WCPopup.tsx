import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import QRCodeStyling from "qr-code-styling";
import styled from "styled-components";

import Popup from "../Popup";
import { WC_ICON } from "../../core/OmniConnector";

interface WCPopupProps {
  title: string;
  uri: string;
  icon?: string;
  deeplink?: string;
  onClose: () => void;
  popupRef: React.RefObject<WindowProxy | null>;
}

export const WCPopup = observer(({ popupRef, title, uri, icon, deeplink, onClose }: WCPopupProps) => {
  const [copyText, setCopyText] = useState("Copy Link");
  const [iconUrl, setIconUrl] = useState<string | null>(WC_ICON);
  const popupRefInternal = useRef<WindowProxy>(null);

  useImperativeHandle(popupRef, () => popupRefInternal.current!);

  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling>(
    new QRCodeStyling({
      data: uri,
      dotsOptions: { color: "#eeeeee", type: "dots" },
      backgroundOptions: { color: "transparent" },
      shape: "square",
      width: 340,
      height: 340,
      type: "svg",
    })
  );

  const closePopup = () => {
    popupRefInternal.current?.close();
    onClose();
  };

  useEffect(() => {
    qrCode.update({ data: uri });
    qrCode.append(qrCodeRef.current as HTMLElement);
  }, [uri, qrCode]);

  useEffect(() => {
    if (!iconUrl) return;
    qrCode.update({ image: iconUrl, imageOptions: { margin: 8, imageSize: 0.2 } });
  }, [iconUrl]);

  useEffect(() => {
    fetch(icon || WC_ICON)
      .then((res) => res.blob())
      .then(() => setIconUrl(icon || WC_ICON));
  }, [icon]);

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
    <Popup header={<p>{title}</p>} onClose={closePopup}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div ref={qrCodeRef} style={{ width: 340, height: 340 }}></div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <CopyButton onClick={handleCopy}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-copy" viewBox="0 0 16 16">
              <path
                fillRule="evenodd"
                d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"
              ></path>
            </svg>
            <p>{copyText}</p>
          </CopyButton>

          {!!deeplink && (
            <CopyButton onClick={() => (popupRefInternal.current = window.open(deeplink, "_blank"))}>
              <p>Open in {title}</p>
            </CopyButton>
          )}
        </div>
      </div>
    </Popup>
  );
});

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
  border: 1px solid #505357;
  transition: background 0.2s ease-in-out;
  background: #282c30;
  padding: 8px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin: auto;
  flex-shrink: 0;

  &:hover {
    background: #383c40;
  }
`;
