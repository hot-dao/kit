import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { HotConnector } from "../../HotConnector";
import { openBridge, openConnector } from "../router";
import { Recipient } from "../../omni/recipient";
import { BridgeReview } from "../../exchange";
import { OmniWallet } from "../../OmniWallet";
import { Network } from "../../omni/config";
import { Token } from "../../omni/token";
import Popup from "../Popup";

import { TokenCard } from "./TokenCard";
import { PopupOption, PopupOptionInfo } from "../styles";
import { WalletIcon } from "../icons/wallet";

interface PaymentProps {
  connector: HotConnector;
  token: Token;
  amount: bigint;
  recipient?: Recipient;
  onClose: () => void;
  onProcess: (task: Promise<BridgeReview>) => void;
}

export const Payment = observer(({ connector, recipient, token: need, amount: needAmount, onProcess, onClose }: PaymentProps) => {
  const title = `Need ${need.readable(needAmount)} ${need.symbol}`;
  const selectToken = async (from: Token, wallet?: OmniWallet) => {
    onProcess(
      openBridge(connector, {
        sender: wallet,
        autoClose: true,
        type: "exactOut",
        recipient: recipient || Recipient.fromWallet(connector.priorityWallet!),
        readonlyTo: recipient ? true : false,
        amount: need.float(needAmount),
        readonlyAmount: true,
        title: title,
        from: from,
        to: need,
      })
    );
  };

  useEffect(() => {
    if (connector.wallets.length !== 0) return;
    openConnector(connector);
  }, [connector.wallets.length, connector]);

  return (
    <Popup onClose={onClose} header={<p>{title}</p>}>
      {connector.walletsTokens.map(({ token, wallet, balance }) => {
        if (token.id === need.id) return null;
        const availableBalance = token.float(balance) - token.reserve;

        if (need.originalChain === Network.Gonka || need.originalChain === Network.Juno) {
          if (token.id === need.id) return null;
          if (token.originalAddress !== need.originalAddress) return null;

          if (availableBalance < need.float(needAmount)) return null;
          return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
        }

        if (availableBalance * token.usd <= need.usd * need.float(needAmount)) return null;
        return <TokenCard key={token.id} token={token} onSelect={selectToken} hot={connector} wallet={wallet} />;
      })}

      <PopupOption onClick={() => openConnector(connector)}>
        <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WalletIcon />
        </div>
        <PopupOptionInfo>
          <p>Connect wallet</p>
          <span className="wallet-address">To more pay options</span>
        </PopupOptionInfo>
      </PopupOption>
    </Popup>
  );
});
