import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useState } from "react";

import { ArrowRightIcon } from "../icons/arrow-right";

import { Recipient } from "../../core/recipient";
import { chains, WalletType } from "../../core/chains";
import { formatter } from "../../core/utils";

import { PSmall } from "../uikit/text";
import { ImageView } from "../uikit/image";
import { ConnectorType, OmniConnector } from "../../core/OmniConnector";
import { PopupOption, PopupOptionInfo } from "../styles";
import { HotKit } from "../../HotKit";
import { openWalletPicker } from "../router";
import Popup from "../Popup";

interface SelectRecipientProps {
  chain: number;
  kit: HotKit;
  recipient?: Recipient;
  onSelect: (recipient?: Recipient) => void;
  onClose: () => void;
}

export const SelectRecipient = observer(({ recipient, kit, chain, onSelect, onClose }: SelectRecipientProps) => {
  const [customAddress, setCustomAddress] = useState<string>(recipient?.address || "");
  const type = chains.get(chain)?.type;

  if (!type)
    return (
      <Popup onClose={onClose} header={<p>Select recipient</p>}>
        <PSmall>Invalid chain</PSmall>
      </Popup>
    );

  const connectors = kit.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const isError = !Recipient.isValidAddress(chain, customAddress) && customAddress.length > 0;

  const selectCustom = async () => {
    const recipient = await Recipient.fromAddress(chain, customAddress);
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
          {connectors.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", margin: "12px 0" }}>
              <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }}></div>
              <PSmall>OR</PSmall>
              <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }}></div>
            </div>
          )}

          <div style={{ width: "100%" }}>
            <PSmall style={{ textAlign: "left" }}>Enter recipient address, avoid CEX</PSmall>
            <CustomRecipient $error={isError}>
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

            {isError && <PSmall style={{ marginTop: 4, textAlign: "left", color: "#F34747" }}>Invalid {chains.get(chain || type)?.name} address</PSmall>}
          </div>
        </>
      )}
    </Popup>
  );
});

const CustomRecipient = styled.div<{ $error: boolean }>`
  display: flex;
  align-items: center;
  border: 1px solid ${({ $error }) => ($error ? "#F34747" : "#2d2d2d")};
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
