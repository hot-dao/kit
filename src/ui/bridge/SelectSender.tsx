import { observer } from "mobx-react-lite";

import { QRIcon } from "../icons/qr";
import { ArrowRightIcon } from "../icons/arrow-right";
import { HexIcon } from "../icons/hex";

import { ImageView } from "../uikit/image";
import { PLarge, PMedium, PSmall } from "../uikit/text";

import { HotKit } from "../../HotKit";
import { WalletPicker } from "../connect/WalletPicker";
import { PopupOption, PopupOptionInfo } from "../styles";
import { openWalletPicker } from "../router";
import Popup from "../Popup";

import { ConnectorType, OmniConnector } from "../../core/OmniConnector";
import { OmniWallet } from "../../core/OmniWallet";
import { WalletType } from "../../core/chains";
import { formatter } from "../../core/utils";
import styled from "styled-components";

interface SelectSenderProps {
  type: WalletType;
  kit: HotKit;
  disableQR?: boolean;
  depositFlow?: boolean;
  onClose: () => void;
  onSelect: (wallet?: OmniWallet | "qr") => void;
  onDeposit?: () => void;
}

export const SelectSender = observer(({ kit, type, depositFlow, disableQR, onDeposit, onSelect, onClose }: SelectSenderProps) => {
  const connectors = kit.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const noExternal = type === WalletType.OMNI || type === WalletType.COSMOS;

  const selectWallet = async (t: OmniConnector) => {
    if (!t.wallets[0]) return openWalletPicker(t, (w) => (onSelect(w), onClose()));
    onSelect(t.wallets[0]);
    onClose();
  };

  if (connectors.length === 0 && (noExternal || disableQR) && !depositFlow) {
    return (
      <Popup onClose={onClose} header={<p>Select sender</p>}>
        <div style={{ width: "100%", height: 200, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 12 }}>
          <PSmall>
            No compatible wallets found,
            <br />
            try using flow for external wallets
          </PSmall>
        </div>
      </Popup>
    );
  }

  if (connectors.length === 1 && (noExternal || disableQR) && !depositFlow) {
    return <WalletPicker initialConnector={connectors[0]} onSelect={onSelect} onClose={onClose} />;
  }

  return (
    <Popup header={<p>Select sender</p>} onClose={onClose}>
      {connectors.map((t) => (
        <DepositOption key={t.id} onClick={() => selectWallet(t)}>
          <ImageView src={t.icon} alt={t.name} size={44} />
          <PopupOptionInfo>
            <PMedium>{t.name}</PMedium>
            {t.wallets[0]?.address && <PSmall className="wallet-address">{formatter.truncateAddress(t.wallets[0].address)}</PSmall>}
          </PopupOptionInfo>
          {!t.wallets[0]?.address ? <PLarge>Connect</PLarge> : <ArrowRightIcon style={{ flexShrink: 0 }} />}
        </DepositOption>
      ))}

      {!noExternal && !disableQR && (
        <DepositOption onClick={() => (onSelect("qr"), onClose())}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <QRIcon />
          </div>

          <PopupOptionInfo>
            <PMedium>Send via QR code</PMedium>
            <PSmall className="wallet-address">From CEX or external wallet</PSmall>
          </PopupOptionInfo>
        </DepositOption>
      )}

      {depositFlow && (
        <DepositOption onClick={() => (onDeposit?.(), onClose())}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HexIcon />
          </div>

          <PopupOptionInfo>
            <PMedium>Deposit to HEX Balance</PMedium>
            <PSmall className="wallet-address">Deposit funds from any exchange or external wallet to make your exchanges super fast.</PSmall>
          </PopupOptionInfo>
        </DepositOption>
      )}
    </Popup>
  );
});

export const DepositOption = styled.button`
  display: flex;
  padding: 8px;
  align-items: center;
  align-self: stretch;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  border-radius: 24px;
  outline: none;
  border: none;
  background: transparent;
  width: 100%;
  gap: 12px;
  margin-top: 4px;

  img {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    object-fit: cover;
    flex-shrink: 0;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;
