import { useState } from "react";
import { observer } from "mobx-react-lite";

import { formatter, Token } from "../../omni/token";
import { HotConnector } from "../../HotConnector";
import { OmniWallet } from "../../omni/OmniWallet";
import { Chains } from "../../omni/chains";
import { OmniToken } from "../../omni/config";
import { omni } from "../../omni/exchange";

import TokenCard from "./TokenCard";
import Popup from "../Popup";

interface SelectTokenPopupProps {
  hot: HotConnector;
  initialChain?: number;
  onClose: () => void;
  onSelect: (token: Token, wallet?: OmniWallet) => void;
}

export const SelectTokenPopup = ({ hot, initialChain, onClose, onSelect }: SelectTokenPopupProps) => {
  const [chain, setChain] = useState<number | null>(initialChain || null);

  if (chain == null) {
    const chains = [...new Set(hot.tokens.map((token) => token.chain))];
    return (
      <Popup onClose={onClose} header={<p>Select chain</p>}>
        {chains.map(
          (chain) =>
            !!Chains.get(chain).name && (
              <div key={chain} className="connect-item" onClick={() => setChain(chain)}>
                <img src={Chains.get(chain).icon} alt={Chains.get(chain).name} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} />
                <p style={{ fontSize: 24, fontWeight: "bold" }}>{Chains.get(chain).name}</p>
              </div>
            )
        )}
      </Popup>
    );
  }

  if (chain !== -4) {
    return (
      <Popup onClose={onClose} header={<p>Select token</p>}>
        {hot.tokens
          .filter((token) => token.chain === chain)
          .map((token) => {
            const wallet = hot.wallets.find((w) => w.type === token.type);
            return <TokenCard key={token.id} token={token} onSelect={onSelect} hot={hot} wallet={wallet} />;
          })}
      </Popup>
    );
  }

  return (
    <Popup onClose={onClose} header={<p>Select token</p>}>
      {hot.wallets.map(
        (wallet, i) =>
          !!wallet.omniAddress && (
            <div key={wallet.address} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: i > 0 ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32 }}>
                <img src={wallet.icon} alt={wallet.icon} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} />
                <p style={{ marginTop: -4, fontSize: 20, fontWeight: "bold", color: "#c6c6c6" }}>{formatter.truncateAddress(wallet.address, 24)}</p>
              </div>

              <TokenCard token={omni.omni(OmniToken.USDT)} onSelect={onSelect} hot={hot} wallet={wallet} />
              <TokenCard token={omni.omni(OmniToken.USDC)} onSelect={onSelect} hot={hot} wallet={wallet} />
              <TokenCard token={omni.omni(OmniToken.JUNO)} onSelect={onSelect} hot={hot} wallet={wallet} />
              <TokenCard token={omni.omni(OmniToken.NEAR)} onSelect={onSelect} hot={hot} wallet={wallet} />
              <TokenCard token={omni.omni(OmniToken.ETH)} onSelect={onSelect} hot={hot} wallet={wallet} />
            </div>
          )
      )}

      {hot.wallets.length === 0 && (
        <>
          <TokenCard token={omni.omni(OmniToken.USDT)} onSelect={onSelect} hot={hot} />
          <TokenCard token={omni.omni(OmniToken.USDC)} onSelect={onSelect} hot={hot} />
          <TokenCard token={omni.omni(OmniToken.JUNO)} onSelect={onSelect} hot={hot} />
          <TokenCard token={omni.omni(OmniToken.NEAR)} onSelect={onSelect} hot={hot} />
          <TokenCard token={omni.omni(OmniToken.ETH)} onSelect={onSelect} hot={hot} />
        </>
      )}
    </Popup>
  );
};

export default observer(SelectTokenPopup);
