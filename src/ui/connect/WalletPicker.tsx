import { useState } from "react";

import { OmniConnector, OmniConnectorOption } from "../../omni/OmniConnector";
import Popup from "../Popup";

const WalletPicker = ({ initialConnector, onClose }: { initialConnector: OmniConnector | null; onClose: () => void }) => {
  const [connector, setConnector] = useState<OmniConnector | null>(initialConnector ?? null);
  const [wallet, setWallet] = useState<OmniConnectorOption | null>(null);

  if (wallet != null) {
    return (
      <Popup header={<p>Connecting</p>} onClose={onClose}>
        <div style={{ width: "100%", height: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 16 }}>
          <img src={wallet.icon} alt={wallet.name} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 16, background: "#000" }} />
          <h3 style={{ fontSize: 32, fontWeight: "bold", textAlign: "center" }}>{wallet.name}</h3>
        </div>
      </Popup>
    );
  }

  if (connector != null) {
    return (
      <Popup header={<p>Select wallet</p>} onClose={onClose}>
        {connector.options.map((wallet) => (
          <div
            key={wallet.id}
            className="connect-item"
            onClick={async () => {
              setWallet(wallet);
              await connector.connect(wallet.id);
              onClose();
            }}
          >
            <img src={wallet.icon} style={{ background: "#000" }} />
            <div className="connect-item-info">
              <p style={{ fontSize: 20, fontWeight: "bold" }}>{wallet.name}</p>
            </div>
          </div>
        ))}
      </Popup>
    );
  }
};

export default WalletPicker;
