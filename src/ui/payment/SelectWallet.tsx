import { observer } from "mobx-react-lite";
import { useState } from "react";

import { HotConnector } from "../../HotConnector";
import { ConnectorType } from "../../omni/OmniConnector";
import { OmniWallet } from "../../omni/OmniWallet";
import { WalletType } from "../../omni/config";
import { openWalletPicker } from "../router";
import { formatter } from "../../omni/token";
import Popup from "../Popup";

const SelectWallet = ({ isRecipient, hot, type, onSelect, onClose }: { isRecipient: boolean; type: WalletType; onSelect: (wallet?: OmniWallet) => void; hot: HotConnector; onClose: () => void }) => {
  const connectors = hot.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const [customAddress, setCustomAddress] = useState<string>("");

  return (
    <Popup header={isRecipient ? <p>Select recipient</p> : <p>Select sender</p>} onClose={onClose}>
      {type !== WalletType.OMNI && isRecipient && (
        <div style={{ width: "100%", marginBottom: 24 }}>
          <p style={{ fontSize: 16, textAlign: "left" }}>Set custom recipient, avoid CEX</p>
          <div style={styles.inputContainer}>
            <input //
              type="text"
              placeholder="Enter wallet address"
              onChange={(e) => setCustomAddress(e.target.value)}
              value={customAddress}
              style={styles.input}
            />
            <button style={styles.button} onClick={() => {}} disabled={customAddress.length === 0}>
              Select
            </button>
          </div>
        </div>
      )}

      {connectors.map((t) => (
        <div key={t.id} className="connect-item" onClick={() => (t.wallets[0] ? (onSelect(t.wallets[0]), onClose()) : openWalletPicker(t))}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000" }}>
            <img src={t.icon} alt={t.name} />
          </div>
          <div className="connect-item-info">
            <p style={{ fontSize: 20, fontWeight: "bold" }}>{t.name}</p>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address)}</span>}
          </div>
          {!t.wallets[0]?.address && <p>Connect</p>}
        </div>
      ))}
    </Popup>
  );
};

const styles: Record<string, React.CSSProperties> = {
  inputContainer: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #2d2d2d",
    borderRadius: "12px",
    overflow: "hidden",
    marginTop: 8,
  },
  input: {
    width: "100%",
    padding: "12px",
    background: "#161616",
    color: "#fff",
    outline: "none",
    fontSize: "16px",
    fontWeight: "bold",
    textAlign: "left",
    flex: 1,
  },

  button: {
    width: 100,
    color: "#fff",
    background: "#000000",
    borderRadius: 0,
    margin: 0,
  },
};

export default observer(SelectWallet);
