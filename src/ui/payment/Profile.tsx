import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useEffect } from "react";

import { LogoutIcon } from "../icons/logout";
import { WithdrawIcon } from "../icons/withdraw";
import { openBridge, openConnector } from "../router";
import { HotConnector } from "../../HotConnector";
import { formatter } from "../../omni/token";
import { OmniToken } from "../../omni/config";
import { ImageView, TokenCard } from "./TokenCard";
import Popup from "../Popup";

export const Profile = observer(({ hot, onClose }: { hot: HotConnector; onClose: () => void }) => {
  let totalBalance = 0;
  const tokensList = hot.wallets
    .flatMap((wallet) => {
      return hot.tokens.map((token) => ({ token, wallet, balance: hot.balance(wallet, token) }));
    })
    .sort((a, b) => {
      const balanceA = a.token.float(a.balance) * a.token.usd;
      const balanceB = b.token.float(b.balance) * b.token.usd;
      return balanceB - balanceA;
    })
    .map(({ token, wallet, balance }) => {
      totalBalance += token.float(balance) * token.usd;
      if (balance === 0n) return null;
      return (
        <TokenCard //
          control={token.chain === -4 ? <WithdrawIcon /> : null}
          onSelect={() => {
            if (token.chain === -4) hot.withdraw(token.address as OmniToken, +token.float(balance).toFixed(6), { sender: wallet });
            else openBridge(hot, { title: "Exchange", sender: wallet, from: token });
          }}
          key={`${wallet.type}:${wallet.address}:${token.id}`}
          wallet={wallet}
          token={token}
          hot={hot}
        />
      );
    });

  useEffect(() => {
    if (hot.wallets.length > 0) return;
    onClose();
  }, [hot.wallets.length]);

  return (
    <Popup onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", gap: 8 }}>
        {hot.wallets.map((wallet) => (
          <WalletCard onClick={() => wallet.disconnect()}>
            <ImageView src={wallet.icon} alt={wallet.connector.name} size={20} />
            <div>{formatter.truncateAddress(wallet.address, 8)}</div>
            <LogoutIcon width={20} height={20} />
          </WalletCard>
        ))}

        {hot.wallets.length < 6 && (
          <WalletCard style={{ paddingLeft: 12, paddingRight: 12 }} onClick={() => openConnector(hot)}>
            Add wallet
          </WalletCard>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 24, marginTop: 16 }}>
        <BalanceCard>${formatter.amount(totalBalance)}</BalanceCard>
        <p style={{ color: "#d2d2d2", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", gap: 4 }} onClick={() => (onClose(), openBridge(hot, { title: "Exchange" }))}>
          Exchange
        </p>
      </div>

      {tokensList.some((t) => t != null) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginLeft: -8,
            marginTop: 16,
            width: "calc(100% + 16px)",
          }}
        >
          {tokensList}
        </div>
      )}
    </Popup>
  );
});

const WalletCard = styled.div`
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

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const BalanceCard = styled.h2`
  font-size: 48px;
  font-weight: 600;
  color: #fff;
`;
