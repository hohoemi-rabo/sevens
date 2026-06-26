"use client";

// QRコード表示。qrcode を使い value を data URL 化して img で描く。
// value はホストの入室URL（http://<lan-ip>:<port>/join?code=<合言葉>）。

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 220, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 2 })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div className={className} style={{ width: size, height: size }} aria-label="QRコードを生成中" />
    );
  }

  return (
    // 静的に生成した data URL。最適化不要なので素の img。
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="入室用QRコード" width={size} height={size} className={className} />
  );
}
