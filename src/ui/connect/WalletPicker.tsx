import { useRef, useState } from "react";
import { observer } from "mobx-react-lite";

import { ImageView } from "../uikit/image";
import { ActionButton } from "../uikit/button";
import { H4, PMedium } from "../uikit/text";

import { OmniWallet } from "../../core/OmniWallet";
import { OmniConnector, OmniConnectorOption } from "../../core/OmniConnector";
import { PopupOption, PopupOptionInfo } from "../styles";

import { WCPopup } from "./WCPopup";
import Popup from "../Popup";

interface WalletPickerProps {
  initialConnector: OmniConnector | null;
  onSelect?: (wallet: OmniWallet) => void;
  onClose: (error?: string | Error | null) => void;
}

export const WalletPicker = observer(({ initialConnector, onSelect, onClose }: WalletPickerProps) => {
  const [connector] = useState<OmniConnector | null>(initialConnector ?? null);
  const [qrcode, setQrcode] = useState<{ uri: string; deeplink?: string; icon?: string } | null>(null);
  const [wallet, setWallet] = useState<OmniConnectorOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const popupRef = useRef<WindowProxy>(null);

  const connectWallet = async (connector: OmniConnector, wallet: OmniConnectorOption) => {
    try {
      setLoading(true);
      setError(null);
      setWallet(wallet);

      const instance = await connector.connect(wallet.id);
      if (typeof instance === "object" && "qrcode" in instance) {
        setQrcode({ uri: instance.qrcode, deeplink: instance.deeplink, icon: connector.icon });
        const wallet = await instance.task;
        onSelect?.(wallet);
        onClose();
        return;
      }

      onSelect?.(instance);
      onClose();
    } catch (e) {
      setError(e?.toString?.() || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (qrcode && !error) {
    return (
      <WCPopup //
        title={wallet?.name || "WalletConnect"}
        icon={wallet?.icon || qrcode.icon}
        deeplink={qrcode.deeplink}
        uri={qrcode.uri}
        onClose={onClose}
        popupRef={popupRef}
      />
    );
  }

  if (wallet != null) {
    return (
      <Popup onClose={() => onClose(error)}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 0 }}>
          <ImageView style={{ marginTop: 32 }} src={wallet.icon} alt={wallet.name} size={100} />

          <H4 style={{ marginTop: 12, textAlign: "center" }}>{wallet.name}</H4>
          <PMedium style={{ textAlign: "center" }}>{error}</PMedium>

          <ActionButton disabled={loading} style={{ marginTop: 32 }} onClick={() => window.open(wallet.download, "_blank")}>
            {loading ? "Connecting..." : "Get wallet"}
          </ActionButton>

          {!!error && !loading && (
            <ActionButton $stroke style={{ marginTop: 8 }} onClick={() => connectWallet(connector!, wallet)}>
              Try again
            </ActionButton>
          )}
        </div>
      </Popup>
    );
  }

  if (connector != null) {
    return (
      <Popup header={<p>Select {connector.name}</p>} onClose={() => onClose(error)}>
        {connector.options.map((wallet) => (
          <PopupOption key={wallet.id} onClick={() => connectWallet(connector, wallet)}>
            <ImageView src={wallet.icon} alt={wallet.name} size={44} />
            <PopupOptionInfo className="connect-item-info">
              <p style={{ fontSize: 20, fontWeight: "bold" }}>{wallet.name}</p>
            </PopupOptionInfo>
          </PopupOption>
        ))}
      </Popup>
    );
  }

  return (
    <Popup header={<p>No wallets found</p>} onClose={() => onClose(error)}>
      <PMedium>Maybe we not support this wallet yet</PMedium>
    </Popup>
  );
});
