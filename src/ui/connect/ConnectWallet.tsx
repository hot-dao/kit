import { observer } from "mobx-react-lite";
import { HotConnector } from "../../HotConnector";
import { ConnectorType, OmniConnector } from "../../omni/OmniConnector";
import { formatter } from "../../omni/token";

import { ImageView } from "../payment/TokenCard";
import { PopupOption, PopupOptionInfo } from "../styles";
import { openWalletPicker } from "../router";
import { LogoutIcon } from "../icons/logout";
import Popup from "../Popup";

interface MultichainPopupProps {
  hot: HotConnector;
  onClose: () => void;
}

export const Connector = observer(({ hot, onClose }: MultichainPopupProps) => {
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
        <PopupOption key={t.id} onClick={() => selectConnector(t)}>
          <ImageView src={t.icon} alt={t.name} size={44} />
          <PopupOptionInfo>
            <p>{t.name}</p>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address, 24)}</span>}
          </PopupOptionInfo>
          {t.wallets[0]?.address && <LogoutIcon />}
        </PopupOption>
      ))}

      {social.length > 0 && (
        <>
          <div style={{ margin: "4px 0", display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
            <div>or</div>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
          </div>

          {social.map((t) => (
            <PopupOption key={t.id} onClick={() => selectConnector(t)}>
              <ImageView src={t.icon} alt={t.name} size={44} />
              <PopupOptionInfo>
                <p>{t.name}</p>
                {t.wallets[0]?.address && <span className="wallet-address">Multichain connected</span>}
              </PopupOptionInfo>
              {t.wallets[0]?.address && <LogoutIcon />}
            </PopupOption>
          ))}
        </>
      )}
    </Popup>
  );
});
