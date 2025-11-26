import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { LogoutIcon } from "../icons/logout";
import { openBridge, openConnector } from "../router";
import { HotConnector } from "../../HotConnector";
import { formatter } from "../../omni/token";
import Popup from "../Popup";

import TokenCard from "./TokenCard";

const Profile = ({ hot, onClose }: { hot: HotConnector; onClose: () => void }) => {
  let totalBalance = 0;
  const tokensList = hot.wallets.map((wallet) => {
    return hot.tokens.map((token) => {
      const balance = hot.balance(wallet, token);
      totalBalance += token.float(balance) * token.usd;
      if (token.float(balance) * token.usd < 0.01) return null;
      return (
        <TokenCard //
          key={`${wallet.type}:${wallet.address}:${token.id}`}
          token={token}
          onSelect={() => {}}
          hot={hot}
          wallet={wallet}
        />
      );
    });
  });

  useEffect(() => {
    if (hot.wallets.length > 0) return;
    onClose();
  }, [hot.wallets.length]);

  return (
    <Popup onClose={onClose}>
      <style>{css}</style>

      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", gap: 8 }}>
        {hot.wallets.map((wallet) => (
          <div key={wallet.address} className="wallet-card" onClick={() => wallet.disconnect()}>
            <img src={wallet.icon} style={{ width: 20, height: 20, objectFit: "cover", borderRadius: 12 }} />
            <div>{formatter.truncateAddress(wallet.address, 8)}</div>
            <LogoutIcon width={20} height={20} />
          </div>
        ))}

        {hot.wallets.length < 5 && (
          <div className="wallet-card" style={{ paddingLeft: 12, paddingRight: 12 }} onClick={() => openConnector(hot)}>
            Add wallet
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 24 }}>
        <h2 className="balance-card">${formatter.amount(totalBalance)}</h2>
        <p style={{ color: "#d2d2d2", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", gap: 4 }} onClick={() => (onClose(), openBridge(hot))}>
          Exchange
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: -8, width: "calc(100% + 16px)" }}>{tokensList}</div>
    </Popup>
  );
};

const css = /*css*/ `
.wallet-card {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 6px;
    padding-left: 8px;
    padding-right: 12px;
    background: #1a1a1a;
    cursor: pointer;
    transition: background 0.2s ease-in-out;
}

.wallet-card:hover {
    background: rgba(255, 255, 255, 0.04);
}

.balance-card {
    font-size: 48px;
    font-weight: 600;
    color: #fff;
}
`;

export default observer(Profile);
