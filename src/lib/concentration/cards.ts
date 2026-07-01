// 神経衰弱のカード定義（純粋TS・通信/UI非依存 / REQUIREMENTS_platform.md §5）。
// トランプ札は 7並べと同じ Card 型を流用（public/cards/ のSVGをそのまま使える）。
// ペアは「同じ数字・2スート限定」（例 ♥7↔♠7）＝数字だけで揃う（シニアに優しい・上限13ペア）。
// 特殊カード（シャッフル/入れ替え/覗き見）はペアにならない単独カードで、通常札に混ぜて伏せる（§5）。

import type { Card, Rank, Suit } from "@/lib/sevens/cards";

/** ペアに使う2スート。各ランクにつき2枚（♥n と ♠n）だけを場に出す＝rank がペアキーになる。 */
export const PAIR_SUITS: readonly [Suit, Suit] = ["h", "s"];

/** 特殊カードの種類（3種・A方式＝めくった瞬間に即発動 / §5.2）。 */
export type SpecialKind = "shuffle" | "swap" | "peek";

/** 特殊カード（ペアにならない単独カード・使い切り）。 */
export interface SpecialCard {
  readonly kind: SpecialKind;
  readonly id: string; // 例 'sp-shuffle-0'（同種複数を一意化）
}

/** 場の1マスに伏せられている中身（トランプ or 特殊）。getView 秘匿はフェーズ3で効く。 */
export type FaceCard =
  | { readonly type: "trump"; readonly card: Card }
  | { readonly type: "special"; readonly special: SpecialCard };

/** トランプ札か。 */
export function isTrump(face: FaceCard): face is { type: "trump"; card: Card } {
  return face.type === "trump";
}

/**
 * 2枚がペアとして揃うか。両方トランプで同じ数字なら成立
 * （2スート×各ランク1枚なので、同ランク＝そのペアの相方で一意）。特殊カードは決して揃わない。
 */
export function isPair(a: FaceCard, b: FaceCard): boolean {
  return isTrump(a) && isTrump(b) && a.card.rank === b.card.rank;
}

/** ペアを作る2枚のトランプ札（♥n, ♠n）を返す。 */
export function pairCards(rank: Rank): [Card, Card] {
  return [
    { suit: PAIR_SUITS[0], rank },
    { suit: PAIR_SUITS[1], rank },
  ];
}
