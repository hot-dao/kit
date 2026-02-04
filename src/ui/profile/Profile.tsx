import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useEffect } from "react";

import PlusIcon from "../icons/plus";
import { LogoutIcon } from "../icons/logout";
import ExchangeIcon from "../icons/exchange";

import { ActionButton } from "../uikit/button";
import { ImageView } from "../uikit/image";
import { Loader } from "../uikit/loader";
import { PMedium } from "../uikit/text";

import { OmniWallet } from "../../core/OmniWallet";
import { ConnectorType } from "../../core/OmniConnector";
import { Network, OmniToken } from "../../core/chains";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";

import { HotKit } from "../../HotKit";
import { openBridge, openConnector } from "../router";
import { TokenCard, TokenIcon } from "../bridge/TokenCard";
import Popup from "../Popup";

export const Profile = observer(({ kit, onClose }: { kit: HotKit; onClose: (wallet?: OmniWallet) => void }) => {
  let totalBalance = 0;

  const tokensList = kit.walletsTokens
    .map(({ token, wallet, balance }) => {
      if (token.float(balance) < 0.000001) return null;
      totalBalance += token.float(balance) * token.usd;
      return {
        chain: token.chain,
        component: (
          <TokenCard //
            onSelect={() => {
              if (token.chain === Network.Omni || token.chain === Network.HotCraft) kit.withdraw(token.address as OmniToken, +token.float(balance).toFixed(6), { sender: wallet });
              else openBridge(kit, { title: "Exchange", sender: wallet, from: token });
            }}
            key={`${wallet.type}:${wallet.address}:${token.id}`}
            wallet={wallet}
            token={token}
            kit={kit}
          />
        ),
      };
    })
    .filter((t) => t != null);

  const omniTokens = tokensList.filter((t) => t.chain === Network.Omni || t.chain === Network.HotCraft);
  const nonOmniTokens = tokensList.filter((t) => t.chain !== Network.Omni && t.chain !== Network.HotCraft);
  const socialConnector = kit.connectors.find((connector) => connector.type === ConnectorType.SOCIAL && connector.wallets.length > 0);
  const connectors = kit.connectors.filter((connector) => connector.type !== ConnectorType.HOTCRAFT);
  const pendings = kit.activity.activityList.filter((t) => t.status === "pending");

  useEffect(() => {
    if (kit.wallets.length > 0) return;
    onClose();
  }, [kit.wallets.length]);

  return (
    <Popup onClose={onClose} style={{ gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", gap: 8 }}>
        {connectors.flatMap((connector) => {
          return connector.wallets.map((wallet) => (
            <WalletCard key={wallet.type} onClick={() => connector.disconnect()}>
              <ImageView src={connector.icon} alt={connector.name} size={20} />
              {connector.icon !== wallet.icon && <ImageView style={{ position: "absolute", bottom: 4, left: 20 }} src={wallet.icon} alt={connector.name} size={12} />}
              <div>{formatter.truncateAddress(wallet.address, 8)}</div>
              <LogoutIcon />
            </WalletCard>
          ));
        })}

        {connectors.some((t) => t.wallets.length === 0) && (
          <WalletCard
            style={{ paddingRight: 12 }}
            onClick={() =>
              openConnector(kit)
                .then((wallet) => onClose(wallet))
                .catch(() => onClose())
            }
          >
            <PlusIcon />
            Add wallet
          </WalletCard>
        )}
      </div>

      <Card>
        <PSmall>YOUR BALANCE</PSmall>
        <BalanceCard>${formatter.amount(totalBalance)}</BalanceCard>

        <div style={{ width: "100%", display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <ActionButton onClick={() => (onClose(), openBridge(kit, { title: "Exchange" }))}>
            <ExchangeIcon />
            Exchange
          </ActionButton>

          {socialConnector != null && (
            <ActionButton onClick={() => socialConnector.openWallet()}>
              <ImageView src={socialConnector.icon} alt={socialConnector.name} size={20} />
              Open wallet
            </ActionButton>
          )}

          <ActionButton disabled onClick={() => (onClose(), openBridge(kit, { title: "Deposit" }))}>
            Deposit
          </ActionButton>
        </div>
      </Card>

      {pendings.length > 0 && (
        <TokenCards>
          <PSmall style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Pendings</PSmall>
          {pendings.map((activity) => {
            return (
              <Card key={activity.id} onClick={() => activity.action()} style={{ flexDirection: "row", gap: 12 }}>
                {activity.preview instanceof Token && <TokenIcon token={activity.preview} />}

                <div>
                  <PMedium style={{ textAlign: "left" }}>{activity.title}</PMedium>
                  <PSmall style={{ textAlign: "left" }}>{activity.subtitle}</PSmall>
                </div>

                {activity.status === "pending" && (
                  <div style={{ marginLeft: "auto", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader />
                  </div>
                )}

                {activity.actionText && !activity.actionLoading && (
                  <div style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 16, background: "#1a1a1a", color: "#fff" }}>
                    <PSmall style={{ color: "#d6d6d6" }}>{activity.actionText}</PSmall>
                  </div>
                )}
              </Card>
            );
          })}
        </TokenCards>
      )}

      {omniTokens.length > 0 && (
        <TokenCards>
          <PSmall style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Tokens to withdraw</PSmall>
          {omniTokens.map((t) => t.component)}
        </TokenCards>
      )}

      {nonOmniTokens.length > 0 && (
        <TokenCards>
          <PSmall style={{ fontSize: 16, fontWeight: 600, color: "#d2d2d2", textAlign: "left" }}>Portfolio</PSmall>
          {nonOmniTokens.map((t) => t.component)}
        </TokenCards>
      )}
    </Popup>
  );
});

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
  position: relative;

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
