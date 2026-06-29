// BGM（ループ再生）プレーヤー（"use client" 前提／ブラウザでのみ動作）。
// public/audio/bgm.mp3 を loop 再生する。未配置でも throw せず無音にフォールバック。
// SFX と違い1本を鳴らし続けるので、単一の <audio> をモジュール内で使い回す。
// 自動再生ポリシーで play() が拒否された場合は、次のユーザー操作で1度だけ再試行する。
// SSR / 非ブラウザ（vitest node）では Audio が無いので no-op。

const SRC = "/audio/bgm.mp3";

let audio: HTMLAudioElement | null = null;
let unavailable = false; // ファイル未配置/壊れ → 以後静かにスキップ
let wantPlaying = false; // 「鳴っていてほしい」意図（再試行や race の判定に使う）
let gestureArmed = false;

function canUseAudio(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function ensure(): HTMLAudioElement | null {
  if (unavailable || !canUseAudio()) return null;
  if (!audio) {
    try {
      const el = new Audio(SRC);
      el.loop = true;
      el.preload = "auto";
      el.addEventListener("error", () => (unavailable = true), { once: true });
      audio = el;
    } catch {
      unavailable = true;
      return null;
    }
  }
  return audio;
}

function attemptPlay(el: HTMLAudioElement): void {
  if (unavailable || !wantPlaying || !el.paused) return;
  const p = el.play();
  // 自動再生ブロックや未配置は致命ではない。ブロック時は次の操作で再試行。
  if (p && typeof p.catch === "function") {
    p.catch(() => armGestureRetry(el));
  }
}

/** 自動再生がブロックされたとき、次のユーザー操作で1度だけ再生を試す。 */
function armGestureRetry(el: HTMLAudioElement): void {
  if (gestureArmed || typeof window === "undefined") return;
  gestureArmed = true;
  const retry = () => {
    gestureArmed = false;
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    attemptPlay(el);
  };
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
}

/** BGM を指定音量で再生（既に再生中なら音量だけ更新）。volume<=0 は停止扱い。 */
export function playBgm(volume: number): void {
  if (volume <= 0) {
    stopBgm();
    return;
  }
  const el = ensure();
  if (!el) return;
  wantPlaying = true;
  el.volume = Math.min(1, Math.max(0, volume));
  attemptPlay(el);
}

/** BGM を停止（一時停止）する。再開すると同じ位置から続く。 */
export function stopBgm(): void {
  wantPlaying = false;
  if (audio && !audio.paused) audio.pause();
}
