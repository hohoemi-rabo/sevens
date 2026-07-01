// 対局画面のページシェル（Server Component）。Next 15 では params が Promise なので await する。
// 対局UIは実質すべて対話なので、薄いシェルから Client の GameRouter を描画する
// （届いた view の形で 7並べ / 神経衰弱の盤面を出し分ける）。

import type { Metadata } from "next";
import { GameRouter } from "@/components/game/GameRouter";

export const metadata: Metadata = {
  title: "対局中",
};

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameRouter roomId={id} />;
}
