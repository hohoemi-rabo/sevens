"use client";

// ゲーム状態の変化を音に変換する副作用フック（docs/14）。
// gameStore の gameState を購読し、前後差分（diffGameState）から鳴らすイベントを導出して
// 効果音（mp3）＋読み上げ（Web Speech）を再生する。描画には影響しない。
// GameBoard で一度だけマウントする想定。

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { useAudioStore } from "@/lib/store/audioStore";
import type { GameState } from "@/lib/sevens/state";
import { cardSpeech } from "@/lib/sevens/cards";
import { diffGameState, type AudioEvent } from "@/lib/audio/events";
import { playSfx, type SfxName } from "@/lib/audio/sfx";
import { speak } from "@/lib/audio/speech";
import { installAudioUnlock } from "@/lib/audio/unlock";

/** イベント種別ごとの効果音（読み上げは play で別途カード名を喋る）。 */
const SFX_FOR: Partial<Record<AudioEvent["kind"], SfxName>> = {
  deal: "shuffle",
  play: "play",
  pass: "pass",
  finish: "applause",
  eliminated: "eliminated",
  end: "end",
};

function announce(event: AudioEvent, volume: number): void {
  switch (event.kind) {
    case "play":
      speak(cardSpeech(event.card), { volume });
      break;
    case "pass":
      speak("パス", { volume });
      break;
    case "finish":
      speak("あがり！", { volume });
      break;
    case "eliminated":
      speak("残念！", { volume });
      break;
    // deal / end は効果音のみ（読み上げ無し）
  }
}

export function useAudioEffects(): void {
  const hydrate = useAudioStore((s) => s.hydrate);
  // 直前に処理した状態。null の間は「セッション最初の状態」をベースライン扱いする。
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    installAudioUnlock();
    hydrate();

    // prev → next を音に変換する共通処理。
    const handle = (next: GameState | null) => {
      if (!next) {
        prevRef.current = null; // 退室・初期化でベースラインに戻す
        return;
      }
      const prev = prevRef.current;
      if (prev === next) return; // 参照同一なら何もしない
      const events = diffGameState(prev, next);
      prevRef.current = next;

      // 実効音量はイベント発火時点の最新値を読む（スライダー変更を即反映）。
      const volume = useAudioStore.getState().effectiveVolume();
      if (volume <= 0 || events.length === 0) return;
      for (const event of events) {
        const sfx = SFX_FOR[event.kind];
        if (sfx) playSfx(sfx, volume);
        announce(event, volume);
      }
    };

    // マウント時点で既に state がある場合（ロビー開始 → 遷移直後の配札状態など）も
    // 処理する。subscribe は「以後の変化」しか拾えないため、ここで現値を1度評価する。
    handle(useGameStore.getState().gameState);

    // gameState の変化を購読（gameState 以外の更新は参照同一でスキップされる）。
    const unsub = useGameStore.subscribe((state) => handle(state.gameState));
    return unsub;
  }, [hydrate]);
}
