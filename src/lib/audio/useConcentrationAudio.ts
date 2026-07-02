"use client";

// 神経衰弱のゲーム状態の変化を音に変換する副作用フック（フェーズ4C）。
// 7並べの useAudioEffects.ts と対の関係: gameStore の gameState を購読し、ConcentrationView の
// 前後差分（diffConcentrationView）から効果音（mp3）＋読み上げ（Web Speech）を再生する。
// ConcentrationBoard で一度だけマウントする想定。描画には影響しない。

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { useAudioStore } from "@/lib/store/audioStore";
import type { GameView } from "@/lib/adapter/types";
import { isConcentrationView } from "@/lib/concentration/view";
import type { ConcentrationView } from "@/lib/concentration/module";
import { diffConcentrationView, type CAudioEvent } from "@/lib/concentration/events";
import { playSfx, type SfxName } from "@/lib/audio/sfx";
import { speak } from "@/lib/audio/speech";
import { installAudioUnlock } from "@/lib/audio/unlock";

/** イベント種別ごとの効果音（未配置 mp3 は無音フォールバック）。 */
const SFX_FOR: Record<CAudioEvent["kind"], SfxName> = {
  deal: "shuffle",
  flip: "flip",
  match: "match",
  miss: "miss",
  special: "special",
  peek: "flip",
  end: "applause",
};

/** 特殊カード種別ごとの効果音（シャッフルは配りと同じ shuffle 音を流用）。 */
const SFX_FOR_SPECIAL: Record<"shuffle" | "swap" | "peek", SfxName> = {
  shuffle: "shuffle",
  swap: "special",
  peek: "special",
};

function announce(event: CAudioEvent, volume: number): void {
  switch (event.kind) {
    case "match":
      speak("そろった！", { volume });
      break;
    case "miss":
      speak("ざんねん", { volume });
      break;
    case "special":
      speak(
        event.special === "shuffle" ? "シャッフルします！" : event.special === "swap" ? "いれかえ！" : "のぞき見！",
        { volume },
      );
      break;
    case "end":
      speak("おしまい！", { volume });
      break;
    // deal / flip / peek は効果音のみ（読み上げ無し）。
  }
}

export function useConcentrationAudio(): void {
  const hydrate = useAudioStore((s) => s.hydrate);
  // 直前に処理した view。null の間は「セッション最初の状態」をベースライン扱いする。
  const prevRef = useRef<ConcentrationView | null>(null);

  useEffect(() => {
    installAudioUnlock();
    hydrate();

    // prev → next を音に変換（このフックは神経衰弱専用＝7並べの view は無視する）。
    const handle = (next: GameView | null) => {
      if (!next || !isConcentrationView(next)) {
        prevRef.current = null; // 退室・初期化・対象外ゲームでベースラインに戻す
        return;
      }
      const prev = prevRef.current;
      if (prev === next) return; // 参照同一なら何もしない
      const events = diffConcentrationView(prev, next);
      prevRef.current = next;

      const volume = useAudioStore.getState().effectiveVolume();
      if (volume <= 0 || events.length === 0) return;
      for (const event of events) {
        // シャッフル特殊は配りと同じ shuffle 音、他は kind→sfx。
        const sfx = event.kind === "special" ? SFX_FOR_SPECIAL[event.special] : SFX_FOR[event.kind];
        if (sfx) playSfx(sfx, volume);
        announce(event, volume);
      }
    };

    // マウント時点で既に state がある場合（開始→遷移直後の配り状態など）も1度評価する。
    handle(useGameStore.getState().gameState);

    const unsub = useGameStore.subscribe((state) => handle(state.gameState));
    return unsub;
  }, [hydrate]);
}
