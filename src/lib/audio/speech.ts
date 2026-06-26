// Web Speech API（音声合成）の薄いラッパ（"use client" 前提／ブラウザでのみ動作）。
// 読み上げ（「ダイヤの8！」「あがり！」等）を録音ファイル無しで動的に発声する。
// 未対応ブラウザ・ミュート時は no-op。SSR / 非ブラウザ（vitest node）では window が無いので何もしない。

/** speechSynthesis が使えるか（ブラウザのみ）。 */
function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

// 日本語ボイスは getVoices() が遅延ロードされることがあるためキャッシュする。
let jaVoice: SpeechSynthesisVoice | null = null;

function pickJaVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (jaVoice) return jaVoice;
  const voices = s.getVoices();
  jaVoice = voices.find((v) => v.lang === "ja-JP") ?? voices.find((v) => v.lang.startsWith("ja")) ?? null;
  return jaVoice;
}

/**
 * voices の非同期ロードに備えてイベントで再取得できるよう購読しておく。
 * 初回 import 時に1度だけ呼ぶ（ブラウザのみ）。
 */
export function warmUpSpeech(): void {
  const s = synth();
  if (!s) return;
  pickJaVoice(s);
  s.addEventListener?.("voiceschanged", () => {
    jaVoice = null; // 次回 pick で再選択
  });
}

export interface SpeakOptions {
  /** 0..1。0（またはミュート相当）なら発声しない。 */
  volume?: number;
}

/**
 * テキストを日本語で読み上げる。新しい発声の前に直前の発声を打ち切り、
 * 連続イベントで音が詰まらないようにする（最新の状況を優先）。
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const volume = opts.volume ?? 1;
  if (volume <= 0) return;
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.volume = Math.min(1, Math.max(0, volume));
    const v = pickJaVoice(s);
    if (v) u.voice = v;
    s.speak(u);
  } catch {
    // 音声合成は付加機能。失敗してもゲーム進行は止めない。
  }
}
