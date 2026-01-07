import { useState } from "react";
import { observer } from "mobx-react-lite";

import { ImageView } from "../uikit/image";
import { OmniWallet } from "../../OmniWallet";
import { OmniConnector, OmniConnectorOption } from "../../OmniConnector";
import { PopupButton, PopupOption, PopupOptionInfo } from "../styles";
import { WCPopup } from "./WCPopup";
import Popup from "../Popup";

interface WalletPickerProps {
  initialConnector: OmniConnector | null;
  onSelect?: (wallet: OmniWallet) => void;
  onClose: () => void;
}

export const WalletPicker = observer(({ initialConnector, onSelect, onClose }: WalletPickerProps) => {
  const [connector] = useState<OmniConnector | null>(initialConnector ?? null);
  const [qrcode, setQrcode] = useState<{ uri: string; deeplink?: string; icon?: string } | null>(null);
  const [wallet, setWallet] = useState<OmniConnectorOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (qrcode) {
    return (
      <WCPopup //
        title={wallet?.name || "WalletConnect"}
        icon={wallet?.icon || qrcode.icon}
        deeplink={qrcode.deeplink}
        uri={qrcode.uri}
        onClose={onClose}
      />
    );
  }

  if (wallet != null) {
    return (
      <Popup onClose={onClose}>
        <div style={{ width: "100%", height: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 0 }}>
          <ImageView style={{ marginTop: "auto" }} src={wallet.icon} alt={wallet.name} size={100} />

          <h3 style={{ fontSize: 32, margin: "12px 0 0", fontWeight: "bold", textAlign: "center" }}>{wallet.name}</h3>
          <p style={{ textAlign: "center" }}>{error}</p>
          <PopupButton disabled={loading} style={{ marginTop: "auto" }} onClick={() => window.open(wallet.download, "_blank")}>
            {loading ? "Connecting..." : "Get wallet"}
          </PopupButton>
        </div>
      </Popup>
    );
  }

  if (connector != null) {
    return (
      <Popup header={<p>Select wallet</p>} onClose={onClose}>
        {connector.options.map((wallet) => (
          <PopupOption
            key={wallet.id}
            onClick={async () => {
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
                console.error(e);
                setError(e instanceof Error ? e.message : "Unknown error");
              } finally {
                setLoading(false);
              }
            }}
          >
            <ImageView src={wallet.icon} alt={wallet.name} size={44} />
            <PopupOptionInfo className="connect-item-info">
              <p style={{ fontSize: 20, fontWeight: "bold" }}>{wallet.name}</p>
            </PopupOptionInfo>
          </PopupOption>
        ))}
      </Popup>
    );
  }
});
