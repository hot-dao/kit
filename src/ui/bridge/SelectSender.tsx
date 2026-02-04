import { observer } from "mobx-react-lite";

import { QRIcon } from "../icons/qr";
import { ArrowRightIcon } from "../icons/arrow-right";
import { ImageView } from "../uikit/image";

import { HotKit } from "../../HotKit";
import { PopupOption, PopupOptionInfo } from "../styles";
import { openWalletPicker } from "../router";
import Popup from "../Popup";

import { ConnectorType, OmniConnector } from "../../core/OmniConnector";
import { OmniWallet } from "../../core/OmniWallet";
import { WalletType } from "../../core/chains";
import { formatter } from "../../core/utils";

interface SelectSenderProps {
  type: WalletType;
  kit: HotKit;
  onClose: () => void;
  onSelect: (wallet?: OmniWallet | "qr") => void;
}

export const SelectSender = observer(({ kit, type, onSelect, onClose }: SelectSenderProps) => {
  const connectors = kit.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const noExternal = type === WalletType.OMNI || type === WalletType.COSMOS;

  const selectWallet = async (t: OmniConnector) => {
    if (!t.wallets[0]) return openWalletPicker(t, (w) => (onSelect(w), onClose()));
    onSelect(t.wallets[0]);
    onClose();
  };

  return (
    <Popup header={<p>Select sender</p>} onClose={onClose}>
      {!noExternal && (
        <PopupOption onClick={() => (onSelect("qr"), onClose())}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <QRIcon />
          </div>
          <PopupOptionInfo>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>Send via QR code</p>
            <span className="wallet-address">From CEX or external wallet</span>
          </PopupOptionInfo>
        </PopupOption>
      )}

      {connectors.map((t) => (
        <PopupOption key={t.id} onClick={() => selectWallet(t)}>
          <ImageView src={t.icon} alt={t.name} size={44} />
          <PopupOptionInfo>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>{t.name}</p>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address)}</span>}
          </PopupOptionInfo>
          {!t.wallets[0]?.address ? <p>Connect</p> : <ArrowRightIcon style={{ flexShrink: 0 }} />}
        </PopupOption>
      ))}
    </Popup>
  );
});
