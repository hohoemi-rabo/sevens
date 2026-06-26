"use client";

// サーバーのLAN情報を取得。ホスト画面の QR/URL 生成に使う。
// /api/server-info（os.networkInterfaces 由来）を1回フェッチする。

import { useEffect, useState } from "react";

export interface ServerInfo {
  ip: string;
  ips: string[];
  port: number;
  url: string;
}

export const useServerInfo = (): ServerInfo | null => {
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/server-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ServerInfo | null) => {
        if (alive) setInfo(data);
      })
      .catch(() => {
        if (alive) setInfo(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return info;
};
