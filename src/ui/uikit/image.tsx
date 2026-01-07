import { useEffect, useState } from "react";

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
