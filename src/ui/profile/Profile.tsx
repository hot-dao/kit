import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useEffect } from "react";

import PlusIcon from "../icons/plus";
import { LogoutIcon } from "../icons/logout";
import ExchangeIcon from "../icons/exchange";

import { formatter } from "../../core/utils";
import { OmniToken } from "../../core/chains";
import { tokens } from "../../core/tokens";

import { openBridge, openConnector } from "../router";
import { HotConnector } from "../../HotConnector";

import { TokenCard, TokenIcon } from "../bridge/TokenCard";
import { ImageView } from "../uikit/image";
import { Loader } from "../uikit/loader";
import { PopupOption } from "../styles";
import Popup from "../Popup";

export const Profile = observer(({ hot, onClose }: { hot: HotConnector; onClose: () => void }) => {
  let totalBalance = 0;

  const tokensList = hot.walletsTokens
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
    })
    .filter((t) => t != null);

  const omniTokens = tokensList.filter((t) => t.chain === -4);
  const nonOmniTokens = tokensList.filter((t) => t.chain !== -4);

  useEffect(() => {
    if (hot.wallets.length > 0) return;
    onClose();
  }, [hot.wallets.length]);

  return (
    <Popup onClose={onClose} style={{ gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", gap: 8 }}>
        {hot.connectors.map((connector) =>
          connector.wallets.map((wallet) => (
            <WalletCard onClick={() => connector.disconnect()}>
              <ImageView src={wallet.icon} alt={connector.name} size={20} />
              <div>{formatter.truncateAddress(wallet.address, 8)}</div>
              <LogoutIcon />
            </WalletCard>
          ))
        )}

        {hot.wallets.length < 6 && (
          <WalletCard style={{ paddingRight: 12 }} onClick={() => openConnector(hot)}>
            <PlusIcon />
            Add wallet
          </WalletCard>
        )}
      </div>

      <Card>
        <PSmall>YOUR BALANCE</PSmall>
        <BalanceCard>${formatter.amount(totalBalance)}</BalanceCard>

        <div style={{ width: "100%", display: "flex", gap: 12, marginTop: 24 }}>
          <ActionButton onClick={() => (onClose(), openBridge(hot, { title: "Exchange" }))}>
            <ExchangeIcon />
            Exchange
          </ActionButton>
          <ActionButton disabled onClick={() => (onClose(), openBridge(hot, { title: "Deposit" }))}>
            Deposit
          </ActionButton>
        </div>
      </Card>

      {hot.activity.withdrawalsList.length > 0 && (
        <TokenCards>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Pending withdrawals</p>
          {hot.activity.withdrawalsList.map((withdrawal) => {
            const token = tokens.get(withdrawal.token as OmniToken, withdrawal.chain);
            return (
              <PopupOption key={withdrawal.nonce} onClick={() => hot.activity.finishWithdrawal(withdrawal)} disabled={withdrawal.loading}>
                <TokenIcon token={token} />

                <div>
                  <p style={{ marginTop: -4, textAlign: "left", fontSize: 20, fontWeight: "bold" }}>
                    {token.float(withdrawal.amount)} {token.symbol}
                  </p>
                  <p style={{ textAlign: "left", fontSize: 12, color: "#828282" }}>{new Date(withdrawal.timestamp).toLocaleString()}</p>
                </div>

                <div style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 16, background: "#1a1a1a", color: "#fff" }}>
                  <p style={{ color: "#d6d6d6" }}>{withdrawal.loading ? <Loader /> : "Withdraw"}</p>
                </div>
              </PopupOption>
            );
          })}
        </TokenCards>
      )}

      {omniTokens.length > 0 && (
        <TokenCards>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Tokens to withdraw</p>
          {omniTokens.map((t) => t.component)}
        </TokenCards>
      )}

      {nonOmniTokens.length > 0 && (
        <TokenCards>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Portfolio</p>
          {nonOmniTokens.map((t) => t.component)}
        </TokenCards>
      )}
    </Popup>
  );
});

const ActionButton = styled.button`
  display: flex;
  padding: 0 24px;
  border-radius: 12px;
  background: #e7e7e7;
  border: none;
  outline: none;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;

  color: #121212;
  text-align: center;
  font-family: "Golos Text";
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: -0.16px;

  &:hover {
    background: #d2d2d2;
  }

  &:disabled {
    background: #3e3e3e;
    color: #828282;
    cursor: not-allowed;
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
  padding-right: 8px;
  background: #1a1a1a;
  cursor: pointer;
  transition: background 0.2s ease-in-out;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const BalanceCard = styled.h2`
  color: #fff;
  font-family: "Golos Text";
  font-size: 32px;
  font-style: normal;
  font-weight: 600;
  line-height: 44px;
  text-align: left;
  margin: 0;
`;

const PSmall = styled.p`
  color: #bfbfbf;
  font-family: "Golos Text";
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: -0.14px;
  text-align: left;
  margin: 0;
`;

const Card = styled.div`
  display: flex;
  padding: 12px;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid #323232;
  background: #272727;
  width: 100%;
`;
