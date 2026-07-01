// 場（盤面）の生成（純粋TS / REQUIREMENTS_platform.md §5.3-5.5）。
// ペア札（数字ペア）・点数差ペア・特殊カードを配置し、決定論シャッフルで伏せて並べる。
// rng は seededRng を注入すればテストで再現可能（7並べと同方針）。

import type { Card, Rank } from "@/lib/sevens/cards";
import { RANKS } from "@/lib/sevens/cards";
import { type Rng, shuffle } from "@/lib/sevens/deal";
import { type FaceCard, type SpecialKind, pairCards } from "@/lib/concentration/cards";

/** 場の1マス。face は中身の真実（getView 秘匿はフェーズ3で効く）。 */
export interface Slot {
  readonly pos: number; // 位置インデックス 0..N-1（安定）
  readonly face: FaceCard;
  readonly status: "facedown" | "collected" | "used"; // used=特殊カードが発動済み
  readonly owner?: number; // collected のとき獲得した席
}

/** 設定可能な定数（§9: これ以外のパラメータは足さない）。 */
export interface ConcentrationConfig {
  readonly pairCount: number; // 1..13（フル=13 / 教室=10）
  readonly specialRatio: number; // トランプ枚数に対する特殊カードの割合（1〜2割目安）
  readonly shuffleSwapPairs: number; // シャッフル特殊が動かす組数（2〜3）
  readonly highValueRatio: number; // 高得点ペアの割合（1〜2割目安）
}

/** プリセット（モード＝設定のプリセット / §5.3）。 */
export const MODE_FULL: ConcentrationConfig = {
  pairCount: 13,
  specialRatio: 0.15,
  shuffleSwapPairs: 2,
  highValueRatio: 0.15,
};
export const MODE_CLASSROOM: ConcentrationConfig = {
  pairCount: 10,
  specialRatio: 0.15,
  shuffleSwapPairs: 2,
  highValueRatio: 0.15,
};

export const MAX_PAIRS = RANKS.length; // 13（2スート限定なので上限13ペア）
const SPECIAL_KINDS: readonly SpecialKind[] = ["shuffle", "swap", "peek"];

/** pairCount が妥当か（1..13）。 */
export function isValidPairCount(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAIRS;
}

/**
 * 高得点ランクの点数を決める。ほとんど1点、highValueRatio 分だけ 2〜3点にする（§5.5）。
 * selectedRanks は既にシャッフル済み順なので、先頭から high-value に割り当てれば決定論かつランダム。
 */
function assignPoints(selectedRanks: readonly Rank[], highValueRatio: number): Partial<Record<Rank, number>> {
  const points: Partial<Record<Rank, number>> = {};
  for (const r of selectedRanks) points[r] = 1;
  const highCount = Math.round(selectedRanks.length * highValueRatio);
  for (let i = 0; i < highCount; i++) {
    // 高得点ペアは 2点を基本に、半数を 3点へ（「数組だけ2〜3点」）。
    points[selectedRanks[i]] = i % 2 === 0 ? 2 : 3;
  }
  return points;
}

/** 特殊カードを specialCount 枚、3種へほぼ均等に割り当てて生成する。 */
function buildSpecials(specialCount: number): FaceCard[] {
  const faces: FaceCard[] = [];
  const perKind: Record<SpecialKind, number> = { shuffle: 0, swap: 0, peek: 0 };
  for (let i = 0; i < specialCount; i++) {
    const kind = SPECIAL_KINDS[i % SPECIAL_KINDS.length];
    faces.push({ type: "special", special: { kind, id: `sp-${kind}-${perKind[kind]}` } });
    perKind[kind]++;
  }
  return faces;
}

/**
 * 場を生成する。pairCount 組の数字ペア（各2枚）＋点数差＋特殊カードを、決定論シャッフルで伏せて並べる。
 * 返り値の pointByRank は「その数字のペアを揃えたときの点数」。
 */
export function generateBoard(
  config: ConcentrationConfig,
  rng: Rng,
): { slots: Slot[]; pointByRank: Partial<Record<Rank, number>> } {
  if (!isValidPairCount(config.pairCount)) {
    throw new Error(`pairCount must be 1..${MAX_PAIRS}: ${config.pairCount}`);
  }
  // どの数字を使うか（13ランクから pairCount 個を無作為に選ぶ＝毎回ちがう顔ぶれ）。
  const selectedRanks = shuffle(RANKS, rng).slice(0, config.pairCount);
  const pointByRank = assignPoints(selectedRanks, config.highValueRatio);

  const trumpFaces: FaceCard[] = [];
  for (const rank of selectedRanks) {
    const [a, b]: [Card, Card] = pairCards(rank);
    trumpFaces.push({ type: "trump", card: a }, { type: "trump", card: b });
  }

  const specialCount = Math.round(trumpFaces.length * config.specialRatio);
  const specialFaces = buildSpecials(specialCount);

  // 全札を伏せて位置に並べる。
  const faces = shuffle([...trumpFaces, ...specialFaces], rng);
  const slots: Slot[] = faces.map((face, pos) => ({ pos, face, status: "facedown" }));
  return { slots, pointByRank };
}
