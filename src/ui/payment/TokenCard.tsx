import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { formatter, Token } from "../../omni/token";
import { HotConnector } from "../../HotConnector";
import { OmniWallet } from "../../omni/OmniWallet";

const images = {
  cached: new Map<string, Promise<void>>(),
  cache(url: string): Promise<void> {
    if (this.cached.has(url)) return this.cached.get(url)!;
    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });

    this.cached.set(url, promise);
    return promise;
  },
};

enum ImageState {
  Loading = "loading",
  Loaded = "loaded",
  Error = "error",
}

const styled: Record<string, React.CSSProperties> = {
  chainIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: "50%",
    backgroundColor: "#101010",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export const TokenIcon = ({ token, wallet }: { token: Token; wallet?: OmniWallet }) => {
  const [icon, setIcon] = useState<ImageState>(ImageState.Loading);
  const [chainIcon, setChainIcon] = useState<ImageState>(ImageState.Loading);
  const [walletIcon, setWalletIcon] = useState<ImageState>(ImageState.Loading);

  useEffect(() => {
    setIcon(ImageState.Loading);
    setChainIcon(ImageState.Loading);
    images
      .cache(token.icon)
      .then(() => setIcon(ImageState.Loaded))
      .catch(() => setIcon(ImageState.Error));

    images
      .cache(token.chainIcon)
      .then(() => setChainIcon(ImageState.Loaded))
      .catch(() => setChainIcon(ImageState.Error));

    if (token.chain === -4 && wallet?.icon) {
      images
        .cache(wallet.icon)
        .then(() => setWalletIcon(ImageState.Loaded))
        .catch(() => setWalletIcon(ImageState.Error));
    }
  }, [token.icon, wallet, token.chainIcon]);

  return (
    <div style={{ position: "relative" }}>
      {icon === ImageState.Loaded ? (
        <img src={token.icon} alt={token.symbol} style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#1c1c1c" }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>{token.symbol.charAt(0)}</p>
        </div>
      )}

      {chainIcon === ImageState.Loaded ? (
        <img src={token.chainIcon} alt={token.symbol} style={styled.chainIcon} />
      ) : (
        <div style={styled.chainIcon}>
          <p style={{ fontSize: 9, color: "#fff" }}>{token.chain.toString().charAt(0)}</p>
        </div>
      )}

      {token.chain === -4 && wallet?.type && (
        <>
          {chainIcon === ImageState.Loaded ? (
            <img src={wallet.icon} style={{ ...styled.chainIcon, left: 0 }} />
          ) : (
            <div style={{ ...styled.chainIcon, left: 0 }}>
              <p style={{ fontSize: 9, color: "#fff" }}>{wallet.type.toString().charAt(0)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const TokenCard = ({ token, onSelect, hot, wallet }: { token: Token; onSelect: (token: Token, wallet?: OmniWallet) => void; hot: HotConnector; wallet?: OmniWallet }) => {
  const balance = hot.balance(wallet, token);
  return (
    <div key={token.id} onClick={() => onSelect(token, wallet)} className="connect-item">
      <TokenIcon token={token} wallet={wallet} />

      <div style={{ marginTop: -2, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
        <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{token.symbol}</p>
        <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(token.usd)}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
        <p style={{ textAlign: "right", fontSize: 20 }}>{token.readable(balance)}</p>
        <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${token.readable(balance, token.usd)}</p>
      </div>
    </div>
  );
};

export default observer(TokenCard);
