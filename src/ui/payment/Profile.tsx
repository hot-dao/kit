import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useEffect } from "react";

import { LogoutIcon } from "../icons/logout";
import { openBridge, openConnector } from "../router";
import { HotConnector } from "../../HotConnector";
import { formatter } from "../../core/utils";
import { OmniToken } from "../../core/chains";
import { tokens } from "../../core/tokens";
import Popup from "../Popup";

import { ImageView, TokenCard } from "./TokenCard";
import ExchangeIcon from "../icons/exchange";

export const Profile = observer(({ hot, onClose }: { hot: HotConnector; onClose: () => void }) => {
  let totalBalance = 0;
  const tokensList = hot.wallets
    .flatMap((wallet) => {
      return tokens.list.map((token) => ({ token, wallet, balance: hot.balance(wallet, token) }));
    })
    .sort((a, b) => {
      const balanceA = a.token.float(a.balance) * a.token.usd;
      const balanceB = b.token.float(b.balance) * b.token.usd;
      return balanceB - balanceA;
    })
    .map(({ token, wallet, balance }) => {
      if (token.float(balance) < 0.000001) return null;
      totalBalance += token.float(balance) * token.usd;
      return {
        chain: token.chain,
        component: (
          <TokenCard //
            onSelect={() => {
              if (token.chain === -4) hot.withdraw(token.address as OmniToken, +token.float(balance).toFixed(6), { sender: wallet });
              else openBridge(hot, { title: "Exchange", sender: wallet, from: token });
            }}
            key={`${wallet.type}:${wallet.address}:${token.id}`}
            wallet={wallet}
            token={token}
            hot={hot}
          />
        ),
      };
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

      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 8, marginTop: 16 }}>
        <BalanceCard>${formatter.amount(totalBalance)}</BalanceCard>
        <ExchangeButton onClick={() => (onClose(), openBridge(hot, { title: "Exchange" }))}>
          <ExchangeIcon size={32} strokeColor="#d2d2d2" />
        </ExchangeButton>
      </div>

      {tokensList.filter((t) => t != null && t.chain === -4).length > 0 && (
        <TokenCards style={{ marginTop: 16 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Tokens to withdraw</p>
          {tokensList.filter((t) => t != null && t.chain === -4).map((t) => t?.component)}
          <div style={{ marginTop: 8, marginBottom: -4, width: "100%", height: 1, background: "#383d42" }}></div>
        </TokenCards>
      )}

      {tokensList.filter((t) => t != null && t.chain !== -4).length > 0 && (
        <TokenCards style={{ marginTop: 16 }}>
          {/* Tokens to exchange */}
          {tokensList.filter((t) => t != null && t.chain !== -4).map((t) => t?.component)}
        </TokenCards>
      )}
    </Popup>
  );
});

const ExchangeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
  border: none;
  background: transparent;
  padding: 8px;
  border-radius: 24px;
  transition: background 0.2s ease-in-out;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const TokenCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

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
