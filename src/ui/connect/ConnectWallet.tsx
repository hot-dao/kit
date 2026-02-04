import { observer } from "mobx-react-lite";

import { OmniWallet } from "../../core/OmniWallet";
import { HotKit } from "../../HotKit";
import { ConnectorType, OmniConnector } from "../../core/OmniConnector";

import { formatter } from "../../core/utils";
import { WalletType } from "../../core";

import { openWalletPicker } from "../router";
import { PopupOption, PopupOptionInfo } from "../styles";
import { LogoutIcon } from "../icons/logout";
import { ImageView } from "../uikit/image";
import Popup from "../Popup";

interface MultichainPopupProps {
  kit: HotKit;
  onClose: (wallet?: OmniWallet) => void;
  title?: string;
  walletType?: WalletType;
  widget?: boolean;
}

export const Connector = observer(({ kit, onClose, title, walletType, widget }: MultichainPopupProps) => {
  const onechain = kit.connectors.filter((t) => t.type === ConnectorType.WALLET && (walletType == null || t.walletTypes.includes(walletType as WalletType)) && t.options.length > 0);
  const social = kit.connectors.filter((t) => t.type === ConnectorType.SOCIAL && (walletType == null || t.walletTypes.includes(walletType as WalletType)));

  const selectConnector = async (t: OmniConnector) => {
    if (t.wallets[0]) return t.disconnect();
    if (t.options.length > 0) return openWalletPicker(t, (w) => onClose(w));
    await t.connect().finally(() => onClose());
  };

  return (
    <Popup header={<p>{title || "Connect wallet"}</p>} onClose={onClose} widget={widget}>
      {social.length > 0 && (
        <>
          {social.map((t) => (
            <PopupOption key={t.id} onClick={() => selectConnector(t)}>
              <ImageView src={t.icon} alt={t.name} size={44} />
              <PopupOptionInfo>
                <p>{t.name}</p>
                {t.wallets[0]?.address && <span className="wallet-address">Multichain connected</span>}
              </PopupOptionInfo>
              {t.wallets[0]?.address && <LogoutIcon width={32} height={32} />}
            </PopupOption>
          ))}

          <div style={{ margin: "4px 0 6px", display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
            <div>or</div>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
          </div>
        </>
      )}

      {onechain.map((t) => (
        <PopupOption key={t.id} onClick={() => selectConnector(t)}>
          <ImageView src={t.icon} alt={t.name} size={44} />
          <PopupOptionInfo>
            <p>{t.name}</p>
            {t.wallets[0]?.address ? <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address, 24)}</span> : <span className="wallet-address">{t.description}</span>}
          </PopupOptionInfo>
          {t.wallets[0]?.address && <LogoutIcon width={32} height={32} />}
        </PopupOption>
      ))}
    </Popup>
  );
});
