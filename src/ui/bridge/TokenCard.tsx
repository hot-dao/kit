import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { chains } from "../../core/chains";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";

import { HotKit } from "../../HotKit";
import { OmniWallet } from "../../core/OmniWallet";
import { ImageView } from "../uikit/image";

export const TokenIcon = observer(({ token, wallet, withoutChain, size = 40 }: { token: Token; wallet?: OmniWallet | "qr"; withoutChain?: boolean; size?: number }) => {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <ImageView src={token.icon} alt={token.symbol} size={size} />
      {!withoutChain && <ImageView src={token.chainIcon} alt={token.symbol} size={size / 2 - 6} style={{ position: "absolute", bottom: 0, right: 0 }} />}
      {token.isOmni && wallet !== "qr" && wallet?.type && <ImageView src={wallet.icon} alt={chains.getByType(wallet.type)?.[0]?.name || ""} size={size / 2 - 6} style={{ position: "absolute", bottom: 0, left: 0 }} />}
    </div>
  );
});

interface TokenCardProps<T extends OmniWallet | "qr"> {
  token: Token;
  onSelect?: (token: Token, wallet?: T) => void;
  amount?: bigint;
  kit: HotKit;
  wallet?: T;
  rightControl?: React.ReactNode;
}

export const TokenCard = observer(<T extends OmniWallet | "qr">({ token, onSelect, amount, kit, wallet, rightControl }: TokenCardProps<T>) => {
  const balance = amount || (wallet === "qr" ? 0n : kit.balance(wallet, token));
  const symbol = token.isOmni && !token.isMainOmni ? `${token.symbol} (${token.originalChainSymbol})` : token.symbol;

  return (
    <Card key={token.id} onClick={() => onSelect?.(token, wallet)}>
      <TokenIcon token={token} wallet={wallet} />

      <TokenWrap>
        <Text style={{ textAlign: "left" }}>{symbol}</Text>
        <PSmall style={{ textAlign: "left" }}>${formatter.amount(token.usd)}</PSmall>
      </TokenWrap>

      {rightControl || (
        <TokenWrap style={{ textAlign: "right", paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
          <Text>{token.readable(balance)}</Text>
          <PSmall>${token.readable(balance, token.usd)}</PSmall>
        </TokenWrap>
      )}
    </Card>
  );
});

const Card = styled.div`
  display: flex;
  padding: 12px;
  padding-bottom: 10px;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid #323232;
  background: #272727;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  width: 100%;
  align-items: center;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const PSmall = styled.p`
  color: #bfbfbf;
  font-family: "Golos Text";
  font-size: 12px;
  font-style: normal;
  line-height: 16px;
  letter-spacing: -0.12px;
  text-align: left;
  font-weight: bold;
`;

const Text = styled.p`
  color: #fff;
  text-align: right;
  font-family: "Golos Text";
  font-size: 16px;
  font-style: normal;
  line-height: 22px;
  letter-spacing: -0.16px;
  font-weight: bold;
`;

const TokenWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: -1px;

  &,
  p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
