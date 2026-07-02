// 記憶保持率CPUの手決め（フェーズ4B）。1本のアルゴリズムを保持率でパラメタ化し、弱/中/強を表現する
// （別コードパスは持たない＝弱は recall がほぼ空なので自然に運まかせになる）。決定論のみ（Math.random 禁止）。
//
// 中身の真値はサーバー権威の state.slots が持つ。CPUは「思い出せる伏せ札」だけを recall で引いて使う
// （＝過去に公開でめくられ、保持率フィルタを通った札のみ。初手全知＝無敵を防ぐ核心）。

import type { CpuStrength } from "@/lib/platform/gameModule";
import { isTrump, type FaceCard } from "@/lib/concentration/cards";
import type { Rank } from "@/lib/sevens/cards";
import type { CAction, ConcentrationState } from "@/lib/concentration/state";
import { recall } from "@/lib/concentration/cpu/retention";

/** 伏せ札の位置（昇順・pos は安定）。 */
function facedownPositions(state: ConcentrationState): number[] {
  return state.slots.filter((s) => s.status === "facedown").map((s) => s.pos);
}

/** recall の中に「同じ数字の伏せトランプ2枚」＝揃えられる既知ペアがあれば、その低い方の pos を返す。 */
function knownPairPos(mem: Map<number, FaceCard>): number | null {
  const byRank = new Map<Rank, number[]>();
  for (const [pos, face] of mem) {
    if (!isTrump(face)) continue;
    const list = byRank.get(face.card.rank) ?? [];
    list.push(pos);
    byRank.set(face.card.rank, list);
  }
  let best: number | null = null;
  for (const positions of byRank.values()) {
    if (positions.length >= 2) {
      const low = Math.min(...positions);
      if (best === null || low < best) best = low;
    }
  }
  return best;
}

/**
 * 探索フリップの2枚目（デッドロック回避の要）。候補（1枚目≠の伏せ札）を「ターン単位で1ずつ」巡回選択する。
 * revealClock は毎フリップ +1＝ミスマッチ手番ごとに +2 進むため、そのまま % すると候補数が偶数のとき
 * 半分の位置しか選ばれず膠着する。floor(revealClock/2) にすると手番ごとに indexが +1 され全候補を走査でき、
 * 固定最小の1枚目の相方が O(N) 手番内に必ず共めくりされて場が縮む＝保持率に依存せず必ず終局する。
 */
function rotatingCandidate(candidates: number[], clock: number): number {
  return candidates[Math.floor(clock / 2) % candidates.length];
}

/**
 * 記憶保持率CPUの次の一手。playerId から席を引き、pending と手番の局面に応じて CAction を返す。
 * 適用は state.handleAction（不正手はサーバー側 stepAuto が握り潰して安全停止）。
 */
export function decideConcentration(
  state: ConcentrationState,
  playerId: string,
  strength: CpuStrength,
): CAction {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`No player with id ${playerId}`);
  const seat = player.seat;

  const fd = facedownPositions(state);

  // 2枚めくった後の「見せてから伏せる」＝確定（サーバーが自動でも呼ぶが CPU も返せるように）。
  if (state.pending?.type === "resolve") return { type: "resolve" };

  // 入れ替え特殊: 妥当に2枚選ぶ（最小の相異なる2枚）。候補不足でも throw させないガード。
  if (state.pending?.type === "choose-swap") {
    const [a, b] = fd;
    return { type: "swap", a, b };
  }

  // 覗き見特殊: まだ公開で見ていない札を1枚選ぶ（§5.6「未確認の札」）。無ければ最小の伏せ札。
  if (state.pending?.type === "choose-peek") {
    const unseen = fd.find((pos) => state.seen[pos] === undefined);
    return { type: "peek", pos: unseen ?? fd[0] };
  }

  const mem = recall(state, seat, strength);

  // 2枚目: 1枚目の数字はサーバー真値から直接読む（見えている札に記憶ゲートは不要）。
  // 相方を思い出していればめくって成立。無ければ探索（巡回）。
  if (state.revealed.length === 1) {
    const first = state.revealed[0];
    const firstFace = state.slots[first].face;
    if (isTrump(firstFace)) {
      for (const [pos, face] of mem) {
        if (pos !== first && isTrump(face) && face.card.rank === firstFace.card.rank) {
          return { type: "flip", pos };
        }
      }
    }
    const candidates = fd.filter((pos) => pos !== first);
    return { type: "flip", pos: rotatingCandidate(candidates, state.revealClock) };
  }

  // 1枚目: 揃えられる既知ペアがあれば片方をめくる。無ければ探索の起点＝最小の伏せ札（固定）。
  const pairPos = knownPairPos(mem);
  if (pairPos !== null) return { type: "flip", pos: pairPos };
  return { type: "flip", pos: fd[0] };
}
