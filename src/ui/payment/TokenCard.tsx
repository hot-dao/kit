import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { chains } from "../../core/chains";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";

import { HotConnector } from "../../HotConnector";
import { OmniWallet } from "../../OmniWallet";
import { PopupOption } from "../styles";

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

export const ImageView = ({ src, size = 40, alt, style }: { src: string; size?: number; alt: string; style?: React.CSSProperties }) => {
  const [icon, setIcon] = useState<ImageState>(ImageState.Loading);
  useEffect(() => {
    setIcon(ImageState.Loading);
    images
      .cache(src)
      .then(() => setIcon(ImageState.Loaded))
      .catch(() => setIcon(ImageState.Error));
  }, [src]);

  if (icon === ImageState.Loaded) {
    return <img src={src} alt={alt} style={{ objectFit: "contain", width: size, height: size, borderRadius: "50%", ...style }} />;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", backgroundColor: "#0e0e0e", ...style }}>
      <p style={{ fontWeight: "bold", fontSize: size / 2, color: "#ffffff" }}>{alt.charAt(0)?.toUpperCase()}</p>
    </div>
  );
};

export const TokenIcon = observer(({ token, wallet }: { token: Token; wallet?: OmniWallet }) => {
  return (
    <div style={{ position: "relative", width: 40, height: 40 }}>
      <ImageView src={token.icon} alt={token.symbol} size={40} />
      <ImageView src={token.chainIcon} alt={token.symbol} size={14} style={{ position: "absolute", bottom: 0, right: 0 }} />
      {token.chain === -4 && wallet?.type && <ImageView src={wallet.icon} alt={chains.get(wallet.type)?.name || ""} size={14} style={{ position: "absolute", bottom: 0, left: 0 }} />}
    </div>
  );
});

export const TokenCard = observer(({ token, onSelect, hot, wallet }: { token: Token; onSelect: (token: Token, wallet?: OmniWallet) => void; hot: HotConnector; wallet?: OmniWallet }) => {
  const balance = hot.balance(wallet, token);
  const symbol = token.chain === -4 && !token.isMainOmni ? `${token.originalChainSymbol}_${token.symbol}` : token.symbol;

  return (
    <PopupOption key={token.id} onClick={() => onSelect(token, wallet)}>
      <TokenIcon token={token} wallet={wallet} />

      <div style={{ marginTop: -2, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
        <p style={{ textAlign: "left", fontSize: 20, fontWeight: "bold" }}>{symbol}</p>
        <p style={{ textAlign: "left", fontSize: 14, color: "#c6c6c6" }}>${formatter.amount(token.usd)}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
        <p style={{ textAlign: "right", fontSize: 20 }}>{token.readable(balance)}</p>
        <p style={{ textAlign: "right", fontSize: 14, color: "#c6c6c6" }}>${token.readable(balance, token.usd)}</p>
      </div>
    </PopupOption>
  );
});
