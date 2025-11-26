import React from "react";

import Popup, { present } from "../Popup";
import { OmniConnector } from "../../omni/OmniConnector";

interface LogoutPopupProps {
  connector: OmniConnector;
  onApprove: () => void;
  onReject: () => void;
}

const LogoutPopup: React.FC<LogoutPopupProps> = ({ connector, onApprove, onReject }) => {
  return (
    <Popup header={<p>Disconnect {connector.name}</p>} onClose={onReject}>
      <p style={{ textAlign: "center", color: "#fff" }}>Your local session will be cleared, see you there!</p>
      <button onClick={onApprove}>Bye-bye</button>
    </Popup>
  );
};

export default LogoutPopup;
