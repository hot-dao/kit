import React, { useState } from "react";

import { Token } from "../../core/token";

import Popup from "../Popup";
import { ActionButton } from "../uikit/button";
import { SelectTokenPopup } from "../bridge/SelectToken";
import { HotKit } from "../../HotKit";

interface DepositFlowProps {
  kit: HotKit;
  onClose: () => void;
}

export const DepositFlow: React.FC<DepositFlowProps> = ({ kit, onClose }) => {
  const [token, setToken] = useState<Token | null>(null);

  if (token == null) {
    return <SelectTokenPopup kit={kit} onClose={onClose} onSelect={(t) => setToken(t)} />;
  }

  return (
    <Popup header={<p>Deposit {token.symbol}</p>}>
      <ActionButton onClick={onClose}>Deposit</ActionButton>
    </Popup>
  );
};
