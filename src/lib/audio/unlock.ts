// ブラウザの自動再生ポリシー対策（"use client" 前提）。
// 多くのブラウザはユーザー操作なしの音声再生をブロックする。最初のユーザー操作（pointerdown）
// で音声合成と効果音を一度ウォームアップして、以後のイベント発音を解禁する。
// 1度だけ実行され、解除される。SSR / 非ブラウザでは no-op。

import { preloadSfx } from "@/lib/audio/sfx";
import { warmUpSpeech } from "@/lib/audio/speech";

let installed = false;

/** 初回ユーザー操作で音声を解禁するリスナを1度だけ仕込む。 */
export function installAudioUnlock(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  warmUpSpeech();
  preloadSfx();

  const unlock = () => {
    try {
      // 音声合成エンジンを起こす（resume はブラウザにより no-op だが無害）。
      window.speechSynthesis?.resume?.();
      // 無音のユーティリティを投げてエンジンを温める端末対策（volume 0 なので聞こえない）。
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance("");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch {
      // 解禁は付加処理。失敗しても致命ではない。
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
