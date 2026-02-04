import { createRoot } from "react-dom/client";
import React, { useEffect, useRef } from "react";

import { CloseIcon } from "./icons/close";
import { PopupRoot, ModalContainer, ModalContent, ModalHeader, ModalBody, Footer, GetWalletLink, ModalOverlay } from "./styles";

export const present = (render: (close: () => void) => React.ReactNode) => {
  const div = document.createElement("div");
  div.className = "kit-popup";
  document.body.appendChild(div);
  const root = createRoot(div);

  root.render(
    render(() => {
      root.unmount();
      div.remove();
    })
  );

  return () => {
    root.unmount();
    div.remove();
  };
};

interface PopupProps {
  widget?: boolean;
  children: React.ReactNode;
  header?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
  mobileFullscreen?: boolean;
  height?: number;
}

const Popup = ({ widget, children, header, onClose, style, mobileFullscreen, height }: PopupProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (widget) return;
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.opacity = "1";
        containerRef.current.style.transform = "translateY(0)";
      }

      if (contentRef.current) {
        contentRef.current.style.opacity = "1";
        contentRef.current.style.transform = "translateY(0)";
      }
    }, 100);
  }, []);

  if (widget) {
    return <PopupRoot>{children}</PopupRoot>;
  }

  return (
    <PopupRoot>
      <ModalContainer>
        <ModalOverlay ref={containerRef} onClick={onClose} style={{ opacity: 0, transition: "all 0.2s ease-in-out" }} />
        <ModalContent ref={contentRef} $mobileFullscreen={mobileFullscreen} style={{ opacity: 0, transform: "translateY(20px)", transition: "all 0.2s ease-in-out", maxHeight: height, height }}>
          {header && (
            <ModalHeader>
              {onClose != null && (
                <button onClick={onClose} style={{ position: "absolute", right: 16, top: 16 }}>
                  <CloseIcon />
                </button>
              )}

              {header}
            </ModalHeader>
          )}
          <ModalBody style={{ overflowX: "hidden", ...style }}>{children}</ModalBody>
          <Footer>
            <GetWalletLink href="https://hot-labs.org" rel="noreferrer" target="_blank" style={{ marginLeft: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <p>Secured by</p>
              <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Labs" />
              <p>HOT</p>
            </GetWalletLink>

            <GetWalletLink href="https://download.hot-labs.org/kit" rel="noreferrer" target="_blank">
              Don't have a wallet?
            </GetWalletLink>
          </Footer>
        </ModalContent>
      </ModalContainer>
    </PopupRoot>
  );
};

export default Popup;
