import React, { useState } from "react";
import { OmniWallet } from "../../core/OmniWallet";
import Popup, { present } from "../Popup";
import { PopupButton } from "../styles";

interface AuthIntentPopupProps {
  wallet: OmniWallet;
  onApprove: () => Promise<void>;
  onReject: () => void;
}

const Loader: React.FC = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="48" height="48" style={{ shapeRendering: "auto", display: "block", background: "transparent" }}>
      <circle strokeDasharray="75.39822368615503 27.132741228718345" r="16" strokeWidth="4" stroke="#000" fill="none" cy="50" cx="50">
        <animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="1.408450704225352s" repeatCount="indefinite" type="rotate" attributeName="transform" />
      </circle>
    </svg>
  );
};

export const AuthPopup: React.FC<AuthIntentPopupProps> = ({ onApprove, onReject }) => {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onApprove();
      setLoading(false);
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  return (
    <Popup header={<p>Authorize wallet</p>} onClose={onReject}>
      <p style={{ textAlign: "center", color: "#fff" }}>To verify your account, you need to sign a message, this action is safe, the platform does not have access to your assets.</p>
      <PopupButton
        disabled={loading}
        onClick={handleApprove}
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "48px",
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? <Loader /> : "Sign message"}
      </PopupButton>
    </Popup>
  );
};
