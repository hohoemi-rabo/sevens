// 効果音（mp3）プレーヤー（"use client" 前提／ブラウザでのみ動作）。
// public/audio/<name>.mp3 を事前ロードして再生する。
// ファイルが未配置でも throw せず無音にフォールバックする（後から mp3 を置けば鳴る）。
// SSR / 非ブラウザでは window/Audio が無いので no-op。

/** 効果音の論理名。public/audio/<name>.mp3 と対応する。 */
export type SfxName = "shuffle" | "play" | "pass" | "applause" | "eliminated" | "end";

const SFX_NAMES: readonly SfxName[] = ["shuffle", "play", "pass", "applause", "eliminated", "end"];

const SRC = (name: SfxName) => `/audio/${name}.mp3`;

// 事前ロード済みの「原本」Audio 要素。再生はクローンして重複再生に備える。
const loaded = new Map<SfxName, HTMLAudioElement>();
// 読み込み失敗（ファイル未配置等）を記録し、以後は静かにスキップする。
const unavailable = new Set<SfxName>();
let preloaded = false;

function canUseAudio(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

/** 全効果音を事前ロードする（多重呼び出しは無視）。ブラウザでのみ動作。 */
export function preloadSfx(): void {
  if (preloaded || !canUseAudio()) return;
  preloaded = true;
  for (const name of SFX_NAMES) {
    try {
      const el = new Audio(SRC(name));
      el.preload = "auto";
      // ファイルが無い/壊れている場合は利用不可に倒す（コンソールエラーは出るが致命ではない）。
      el.addEventListener("error", () => unavailable.add(name), { once: true });
      loaded.set(name, el);
    } catch {
      unavailable.add(name);
    }
  }
}

/**
 * 効果音を再生する。未ロード/未配置/ミュート(volume<=0)時は無音。
 * 同じ音の重複再生に備えてクローンを再生する（連続イベントで途切れない）。
 */
export function playSfx(name: SfxName, volume: number): void {
  if (volume <= 0 || !canUseAudio()) return;
  if (unavailable.has(name)) return;
  if (!preloaded) preloadSfx();
  const base = loaded.get(name);
  if (!base) return;
  try {
    const el = base.cloneNode(true) as HTMLAudioElement;
    el.volume = Math.min(1, Math.max(0, volume));
    const p = el.play();
    // play() の Promise 拒否（自動再生ブロック・ファイル未配置）は無視する。
    if (p && typeof p.catch === "function") {
      p.catch(() => unavailable.add(name));
    }
  } catch {
    unavailable.add(name);
  }
}
