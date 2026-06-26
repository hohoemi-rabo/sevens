// 接続の冪等ヘルパ（docs/10）。各導線で重複しがちな
// 「未接続なら LocalAdapter を生成して connect」を1か所に集約する。

import { LocalAdapter } from "@/lib/adapter/local";
import { useGameStore } from "@/lib/store/gameStore";

/** 未接続なら接続する。既に connected なら何もしない。 */
export const ensureConnected = async (): Promise<void> => {
  const store = useGameStore.getState();
  if (store.connection !== "connected") {
    await store.connect(new LocalAdapter());
  }
};
