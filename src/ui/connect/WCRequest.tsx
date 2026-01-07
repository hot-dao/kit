import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { ImageView } from "../uikit/image";
import { PopupButton } from "../styles";
import Popup from "../Popup";

export const WCRequest = observer(({ deeplink, name, icon, onClose, task }: { deeplink?: string; name: string; icon: string; onClose: () => void; task: Promise<any> }) => {
  useEffect(() => {
    task.finally(onClose);
  }, [task]);

  return (
    <Popup onClose={onClose}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <ImageView style={{ marginTop: 32 }} src={icon} alt={name} size={100} />
        <p style={{ fontSize: 24, fontWeight: "bold" }}>{name}</p>
        <p style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.7)" }}>
          Application request you
          <br />
          to approve some action in your wallet
        </p>

        {!!deeplink && <PopupButton onClick={() => window.open(deeplink, "_blank")}>Open wallet</PopupButton>}
      </div>
    </Popup>
  );
});
