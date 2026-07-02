// 記憶保持率CPU（フェーズ4B）の「あえて忘れる」記憶モデル（REQUIREMENTS_platform.md §5.6）。
// 完璧な記憶のCPUは無敵になり「平等な神経衰弱」の狙いに反する。そこで公開でめくられた札
// （state.seen）だけを対象に、保持率フィルタ（強さ×経過）を決定論ハッシュでかけて「思い出せる札」を絞る。
//
// 決定論が絶対条件（Math.random 禁止・7並べCPU踏襲）。ハッシュは state.rngSeed（JSON安全な number）を
// 種にするので、シリアライズ往復やサーバー再起動をまたいでも同じ結論になる。

import type { CpuStrength } from "@/lib/platform/gameModule";
import type { FaceCard } from "@/lib/concentration/cards";
import type { ConcentrationState } from "@/lib/concentration/state";

/**
 * (seed, seat, pos) から決定論的に [0,1) を作る（mulberry32 系の整数ミックス・deal.ts と同系統）。
 * 席ごとに別の札を忘れる（＝全CPUが同一のテレパシー記憶を共有しない）ために seat も混ぜる。
 */
export function hash01(seed: number, seat: number, pos: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (seat + 1), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ (pos + 1), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * 強さ×経過ターン（age）での保持率。全 age で 強≥中≥弱 を満たす（＝弱が覚える札は中/強も覚える
 * ＝recall が包含関係になりテストが綺麗）。強も 1 未満に抑えて無敵化を防ぐ。
 * 既定値。チューニングはフェーズ4Dに委ねるため定数はここに集約する。
 */
export function retentionRate(strength: CpuStrength, age: number): number {
  const a = Math.max(0, age);
  switch (strength) {
    case "weak":
      return 0.35 * Math.pow(0.45, a); // 直近のごく少数のみ（高確率で忘れる）
    case "medium":
      return 0.85 * Math.pow(0.8, a); // そこそこ覚えるが時間で忘れる
    case "strong":
      return Math.min(0.92, 0.92 * Math.pow(0.97, a)); // 多くを覚えるが 100% にはしない
  }
}

/** その席が pos を（age ぶん前に見た札として）思い出せるか。 */
export function retained(seed: number, seat: number, pos: number, age: number, strength: CpuStrength): boolean {
  return hash01(seed, seat, pos) < retentionRate(strength, age);
}

/**
 * その席・強さで「思い出せる伏せ札」を pos→真の face で返す。
 * 対象は「facedown ／ seen にあり ／ この手番でめくり中でない（revealed 除外）／ retained を通る」札のみ。
 * face は state.slots の真値（サーバー権威）。seen が古い face を指さないよう、面が動く特殊は state 側で seen を無効化済み。
 */
export function recall(state: ConcentrationState, seat: number, strength: CpuStrength): Map<number, FaceCard> {
  const mem = new Map<number, FaceCard>();
  for (const slot of state.slots) {
    if (slot.status !== "facedown") continue;
    if (state.revealed.includes(slot.pos)) continue;
    const seenAt = state.seen[slot.pos];
    if (seenAt === undefined) continue;
    const age = state.revealClock - seenAt;
    if (retained(state.rngSeed, seat, slot.pos, age, strength)) {
      mem.set(slot.pos, slot.face);
    }
  }
  return mem;
}
