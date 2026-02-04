import { useState } from "react";
import { observer } from "mobx-react-lite";
import styled from "styled-components";

import { HotKit } from "../../HotKit";
import { OmniWallet } from "../../core/OmniWallet";

import { Network, OmniToken } from "../../core/chains";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";
import { tokens } from "../../core/tokens";
import { PopupOption } from "../styles";
import Popup from "../Popup";

import { ImageView } from "../uikit/image";
import { TokenCard } from "./TokenCard";

interface SelectTokenPopupProps {
  kit: HotKit;
  initialChain?: number;
  onClose: () => void;
  onSelect: (token: Token, wallet?: OmniWallet) => void;
}

export const SelectTokenPopup = observer(({ kit, initialChain, onClose, onSelect }: SelectTokenPopupProps) => {
  const [chain, setChain] = useState<number | null>(initialChain || null);
  const [search, setSearch] = useState<string>("");

  if (chain == null) {
    const chains: Record<number, { chain: number; balance: number; name: string; icon: string }> = {};
    tokens.list.forEach((token) => {
      if (!chains[token.chain])
        chains[token.chain] = {
          chain: token.chain,
          name: token.chainName,
          icon: token.chainIcon,
          balance: 0,
        };

      kit.wallets.forEach((wallet) => {
        const balance = kit.balance(wallet, token);
        chains[token.chain].balance += token.float(balance) * token.usd;
      });
    });

    const sorted = Object.values(chains).sort((a, b) => {
      if (a.chain === Network.Omni) return -1;
      return b.balance - a.balance;
    });

    return (
      <Popup onClose={onClose} header={<p>Select chain</p>} style={{ minHeight: 300 }}>
        <SearchInput type="text" placeholder="Search chain" onChange={(e) => setSearch(e.target.value)} />

        {sorted.map(({ chain, balance, name, icon }) => {
          if (search && !name.toLowerCase().includes(search.toLowerCase())) return;

          return (
            <PopupOption onClick={() => (setChain(chain), setSearch(""))}>
              <ImageView src={icon} alt={name} size={24} />
              <p style={{ fontSize: 24, fontWeight: "bold" }}>{name}</p>
              {balance > 0 && <p style={{ marginLeft: "auto", fontSize: 20, color: "#c6c6c6" }}>${formatter.amount(balance)}</p>}
            </PopupOption>
          );
        })}
      </Popup>
    );
  }

  if (chain !== -4) {
    return (
      <Popup onClose={onClose} header={<p>Select token</p>} style={{ minHeight: 300 }}>
        <SearchInput type="text" placeholder="Search token" onChange={(e) => setSearch(e.target.value)} />

        {tokens.list
          .filter((token) => token.chain === chain && token.symbol.toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => {
            const wallet = kit.wallets.find((w) => w.type === a.type)!;
            const aBalance = a.float(kit.balance(wallet, a)) * a.usd;
            const bBalance = b.float(kit.balance(wallet, b)) * b.usd;
            return bBalance - aBalance;
          })
          .map((token) => {
            const wallet = kit.wallets.find((w) => w.type === token.type);
            if (search && !token.symbol.toLowerCase().includes(search.toLowerCase())) return;
            return <TokenCard key={token.id} token={token} onSelect={onSelect} kit={kit} wallet={wallet} />;
          })}
      </Popup>
    );
  }

  let used = new Set<string>();
  return (
    <Popup onClose={onClose} header={<p>Select token</p>}>
      <SearchInput type="text" placeholder="Search token" onChange={(e) => setSearch(e.target.value)} />
      {kit.walletsTokens
        .filter(({ token, balance }) => {
          if (token.chain !== Network.Omni) return false;
          if (token.float(balance) < 0.0001) return false;
          if (!token.symbol.toLowerCase().includes(search.toLowerCase())) return false;
          used.add(token.address);
          return true;
        })
        .sort((a, b) => {
          const aBalance = a.token.float(a.balance) * a.token.usd;
          const bBalance = b.token.float(b.balance) * b.token.usd;
          return bBalance - aBalance;
        })
        .map(({ token, wallet }) => (
          <TokenCard key={token.id} token={token} onSelect={onSelect} kit={kit} wallet={wallet} />
        ))}

      {Object.values(OmniToken)
        .filter((token) => !used.has(token) && kit.omni(token).symbol.toLowerCase().includes(search.toLowerCase()))
        .map((token) => (
          <TokenCard key={token} token={kit.omni(token)} onSelect={onSelect} kit={kit} wallet={kit.priorityWallet} />
        ))}
    </Popup>
  );
});

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid #282c30;
  background: #282c30;
  color: #fff;
  outline: none;
  font-size: 20px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: -0.32px;
  text-align: left;
  margin-bottom: 8px;
`;
