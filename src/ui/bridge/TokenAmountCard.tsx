import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { chains, WalletType } from "../../core/chains";
import { OmniWallet } from "../../core/OmniWallet";
import { Token } from "../../core/token";
import { formatter } from "../../core";

import { ArrowRightIcon } from "../icons/arrow-right";
import RefreshIcon from "../icons/refresh";

import { HotKit } from "../../HotKit";
import { PLarge, PSmall, PTiny } from "../uikit/text";
import { ImageView } from "../uikit/image";
import { Skeleton } from "../uikit/loader";
import { Button } from "../uikit/button";

import { TokenIcon } from "./TokenCard";

interface TokenAmountCardProps {
  setValue: (value: string) => void;
  setIsFiat: (isFiat: boolean) => void;
  setToken: (token: Token) => void;
  setSender: (sender: OmniWallet | "qr" | undefined) => void;
  handleMax: () => void;

  kit: HotKit;
  style?: React.CSSProperties;
  disableChains?: number[];

  disableQR?: boolean;
  sender: OmniWallet | "qr" | undefined;
  isReviewing: boolean;
  readonlyAmount?: boolean;
  readableAmount: string;
  availableBalance: number;
  amount: number;
  isFiat: boolean;
  token?: Token;
}

export const TokenAmountCard = observer((props: TokenAmountCardProps) => {
  const { style, token, sender, kit, isReviewing, isFiat, amount, disableChains, readableAmount, availableBalance, readonlyAmount, disableQR } = props;
  const { setValue, setIsFiat, setToken, setSender, handleMax } = props;

  return (
    <Card style={{ borderRadius: "20px 20px 2px 2px", ...style }}>
      <CardHeader>
        <ChainButton onClick={() => kit.router.openSelectTokenPopup({ kit, disableChains, onSelect: (token, wallet) => (setToken(token), setSender(wallet)) })}>
          <PSmall>From:</PSmall>
          {token != null && <ImageView src={chains.get(token.chain)?.logo || ""} alt={token.symbol} size={16} />}
          <PSmall>{token != null ? chains.get(token.chain)?.name : "Select chain"}</PSmall>
          <ArrowRightIcon style={{ marginLeft: -8, transform: "rotate(-270deg)" }} color="#ababab" />
        </ChainButton>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PSmall>Sender:</PSmall>
          <BadgeButton onClick={() => (token ? kit.router.openSelectSender({ disableQR, kit, type: token.type, onSelect: (sender) => setSender(sender) }) : {})}>
            <PSmall>{sender == null ? "Select" : sender !== "qr" ? formatter.truncateAddress(sender.address, 8) : "QR"}</PSmall>
            <Tooltip id="sender-tooltip">
              <PSmall>Select sender wallet</PSmall>
            </Tooltip>
          </BadgeButton>
        </div>
      </CardHeader>

      <CardBody>
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <TokenPreview
            token={token}
            onSelect={() =>
              kit.router.openSelectTokenPopup({
                onSelect: (token, wallet) => (setToken(token), setSender(wallet)),
                disableChains: disableChains,
                initialChain: token?.chain,
                kit,
              })
            }
          />

          {isReviewing ? (
            <Skeleton />
          ) : (
            <input //
              name="from"
              type="text"
              className="input"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              readOnly={readonlyAmount}
              value={isFiat ? `$${readableAmount}` : readableAmount}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              autoFocus
            />
          )}
        </div>

        {isFiat && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {sender !== "qr" && (
              <AvailableBalance>
                <PSmall>Balance: ${token != null ? token.readable(availableBalance, token.usd) : 0}</PSmall>
                <Button onClick={() => sender && token != null && kit.fetchToken(token, sender)}>
                  <RefreshIcon color="#fff" />
                </Button>
              </AvailableBalance>
            )}

            {sender === "qr" && <div />}

            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {token != null && token.usd !== 0 && <PSmall style={{ marginRight: 8 }}>{`${token.readable(amount / token.usd)} ${token.symbol}`}</PSmall>}

              {token != null && token.usd !== 0 && (
                <BadgeButton style={{ border: `1px solid #fff` }} onClick={() => setIsFiat(!isFiat)}>
                  <PTiny>USD</PTiny>
                </BadgeButton>
              )}

              {sender !== "qr" && (
                <BadgeButton onClick={handleMax}>
                  <PTiny>MAX</PTiny>
                </BadgeButton>
              )}
            </div>
          </div>
        )}

        {!isFiat && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {sender !== "qr" && token != null && (
              <AvailableBalance>
                <PSmall>Balance: {`${token.readable(availableBalance)} ${token.symbol}`}</PSmall>
                <Button style={{ marginTop: 2 }} onClick={() => sender && kit.fetchToken(token, sender)}>
                  <RefreshIcon color="#fff" />
                </Button>
              </AvailableBalance>
            )}

            {sender === "qr" && <div />}

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {token?.usd !== 0 && <PSmall style={{ marginRight: 8 }}>${token?.readable(amount, token.usd) || 0}</PSmall>}
              {token?.usd !== 0 && (
                <BadgeButton onClick={() => setIsFiat(!isFiat)}>
                  <PTiny>USD</PTiny>
                </BadgeButton>
              )}
              {sender !== "qr" && (
                <BadgeButton onClick={handleMax}>
                  <PTiny>MAX</PTiny>
                </BadgeButton>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
});

export const TokenPreview = ({ style, token, onSelect }: { style?: React.CSSProperties; token?: Token; onSelect: () => void }) => {
  if (token == null)
    return (
      <SelectTokenButton style={style} onClick={() => onSelect()}>
        <ImageView style={{ flexShrink: 0 }} src={""} alt="I" size={32} />
        <PLarge>Select</PLarge>
        <ArrowRightIcon style={{ flexShrink: 0, position: "absolute", right: 4 }} />
      </SelectTokenButton>
    );

  return (
    <SelectTokenButton style={style} onClick={() => onSelect()}>
      <TokenIcon withoutChain token={token} size={32} />
      <PLarge>{token.symbol}</PLarge>
      <ArrowRightIcon style={{ flexShrink: 0, position: "absolute", right: 4 }} />
    </SelectTokenButton>
  );
};

export const Card = styled.div`
  text-align: left;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;

  display: flex;
  width: 100%;

  border-radius: 20px 20px 2px 2px;
  border: 1px solid #323232;
  background: #1f1f1f;

  input {
    outline: none;
    border: none;
    background: none;
    color: #fff;
    font-size: 32px;
    font-weight: bold;
    width: 100%;
    line-height: 40px;
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    background: transparent;
    text-align: right;
    border: none;
    padding: 0;
    margin: 0;
  }
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  width: 100%;
  gap: 8px;
`;

export const CardBody = styled.div`
  padding: 16px;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #323232;
  background: #272727;
  display: flex;
  gap: 8px;
`;

export const BadgeButton = styled.button`
  display: flex;
  border-radius: 8px;
  border: 1px solid #323232;
  padding: 4px 8px;
  background: transparent;
  transition: 0.2s border-color;
  position: relative;
  cursor: pointer;
  outline: none;
  gap: 4px;

  &:hover {
    border-color: #4e4e4e;
  }
`;

export const ChainButton = styled.button`
  display: flex;
  align-items: center;
  padding: 0;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  background: transparent;
  transition: 0.2s opacity;

  &:hover {
    opacity: 0.8;
  }
`;

export const AvailableBalance = styled.div`
  display: flex;
  align-items: center;
  overflow: hidden;
  max-width: 200px;
  white-space: nowrap;
  gap: 4px;

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const Tooltip = styled.div`
  transition: 0.2s transform, 0.2s opacity;
  transform: translateY(8px);
  opacity: 0;
  position: absolute;
  top: -48px;
  right: 0;
  z-index: 100000000;
  border-radius: 16px;
  background: var(--surface-white, #fff);
  padding: 4px 12px;
  justify-content: center;
  pointer-events: none;
  align-items: center;
  gap: 4px;

  p {
    white-space: nowrap;
    color: #000;
  }

  &::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 8px;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid #fff;
  }
`;

export const SelectTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  position: relative;
  background: transparent;
  border-radius: 24px;
  padding: 4px;
  padding-right: 28px;
  margin: -4px;
  max-width: 160px;
  transition: 0.2s background-color;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
