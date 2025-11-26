import { observer } from "mobx-react-lite";
import React from "react";

import { HotConnector } from "../../HotConnector";
import { ConnectorType, OmniConnector } from "../../omni/OmniConnector";
import { formatter } from "../../omni/token";

import { openWalletPicker } from "../router";
import { LogoutIcon } from "../icons/logout";
import Popup from "../Popup";

interface MultichainPopupProps {
  hot: HotConnector;
  onClose: () => void;
}

const Connector: React.FC<MultichainPopupProps> = ({ hot, onClose }) => {
  const onechain = hot.connectors.filter((t) => t.type === ConnectorType.WALLET);
  const social = hot.connectors.filter((t) => t.type === ConnectorType.SOCIAL);

  const selectConnector = async (t: OmniConnector) => {
    if (t.wallets[0]) return t.disconnect();
    if (t.options.length > 0) return [openWalletPicker(t), onClose()];
    await t.connect().finally(() => onClose());
  };

  return (
    <Popup header={<p>Select network</p>} onClose={onClose}>
      {onechain.map((t) => (
        <div key={t.id} className="connect-item" onClick={() => selectConnector(t)}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000" }}>
            <img src={t.icon} alt={t.name} />
          </div>
          <div className="connect-item-info">
            <span>{t.name}</span>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address, 24)}</span>}
          </div>
          {t.wallets[0]?.address && <LogoutIcon />}
        </div>
      ))}

      {social.length > 0 && (
        <>
          <div style={{ margin: "4px 0", display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
            <div>or</div>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
          </div>

          {social.map((t) => (
            <div key={t.id} className="connect-item" onClick={() => selectConnector(t)}>
              <img src={t.icon} alt={t.name} />
              <div className="connect-item-info">
                <span>{t.name}</span>
                {t.wallets[0]?.address && <span className="wallet-address">Multichain connected</span>}
              </div>
              {t.wallets[0]?.address && <LogoutIcon />}
            </div>
          ))}
        </>
      )}
    </Popup>
  );
};

export default observer(Connector);
