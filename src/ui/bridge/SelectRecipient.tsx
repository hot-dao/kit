import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useState } from "react";

import { ArrowRightIcon } from "../icons/arrow-right";

import { Recipient } from "../../core/recipient";
import { WalletType } from "../../core/chains";
import { formatter } from "../../core/utils";

import { PSmall } from "../uikit/text";
import { ImageView } from "../uikit/image";
import { ConnectorType, OmniConnector } from "../../core/OmniConnector";
import { PopupOption, PopupOptionInfo } from "../styles";
import { HotConnector } from "../../HotConnector";
import { openWalletPicker } from "../router";
import Popup from "../Popup";

interface SelectRecipientProps {
  type: WalletType;
  hot: HotConnector;
  recipient?: Recipient;
  onSelect: (recipient?: Recipient) => void;
  onClose: () => void;
}

export const SelectRecipient = observer(({ recipient, hot, type, onSelect, onClose }: SelectRecipientProps) => {
  const connectors = hot.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const [customAddress, setCustomAddress] = useState<string>(recipient?.address || "");

  const selectCustom = async () => {
    const recipient = await Recipient.fromAddress(type, customAddress);
    onSelect(recipient);
    onClose();
  };

  const selectWallet = async (t: OmniConnector) => {
    if (!t.wallets[0]) return openWalletPicker(t, (w) => (onSelect(Recipient.fromWallet(w)), onClose()));
    onSelect(Recipient.fromWallet(t.wallets[0]));
    onClose();
  };

  return (
    <Popup header={<p>Select recipient</p>} onClose={onClose}>
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

      {type !== WalletType.OMNI && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", margin: "12px 0" }}>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }}></div>
            <PSmall>OR</PSmall>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }}></div>
          </div>
          <div style={{ width: "100%" }}>
            <PSmall style={{ textAlign: "left" }}>Enter recipient address, avoid CEX</PSmall>
            <CustomRecipient>
              <input //
                type="text"
                placeholder="Enter wallet address"
                onChange={(e) => setCustomAddress(e.target.value)}
                value={customAddress}
              />
              <button onClick={selectCustom} disabled={customAddress.length === 0}>
                Select
              </button>
            </CustomRecipient>
          </div>
        </>
      )}
    </Popup>
  );
});

const CustomRecipient = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #2d2d2d;
  border-radius: 12px;
  overflow: hidden;
  margin-top: 8px;
  height: 50px;

  input {
    width: 100%;
    padding: 12px;
    background: #161616;
    color: #fff;
    outline: none;
    font-size: 16px;
    font-weight: bold;
    text-align: left;
    outline: none;
    border: none;
    height: 100%;
    flex: 1;
  }

  button {
    width: 100px;
    color: #fff;
    background: #000000;
    border-radius: 0px;
    margin: 0px;
    outline: none;
    border: none;
    height: 100%;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }
`;
