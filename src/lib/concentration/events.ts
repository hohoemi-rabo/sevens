/**
 * 神経衰弱の view 差分から「鳴らすべき音イベント」を導出する純関数（DOM非依存・テスト対象）。
 *
 * 7並べの `src/lib/audio/events.ts`（diffGameState）と同方針: クライアントは席ごとの `game:state`
 * （ConcentrationView）だけを購読し、めくり/成立/お手つき等に専用イベントは無い。前後の view を
 * 差分して「何が起きたか」を導出する。per-seat view で 1遷移=1アクションなので差分は素直。
 *
 * 通信層・UI・ブラウザAPIに一切依存しないこと（CLAUDE.md の3層分離方針）。
 */
import type { ConcentrationView, ViewSlot } from "@/lib/concentration/module";
import type { SpecialKind } from "@/lib/concentration/cards";

/** 鳴らす音の種類。付随情報は種類に応じて付く。 */
export type CAudioEvent =
  | { kind: "deal" } // 配り（開始・再戦の配り直し）
  | { kind: "flip"; pos: number } // 伏せ札を1枚めくった（revealed が増えた）
  | { kind: "match"; seat: number } // ペア成立（collected が増えた）
  | { kind: "miss" } // お手つき＝伏せ戻し（resolve で revealed が空へ・非成立）
  | { kind: "special"; special: SpecialKind } // 特殊カード発動（status→used）
  | { kind: "peek" } // 覗き見の私的リビール（自分の view に facedown+face が乗った）
  | { kind: "end" }; // 終局（phase playing→ended）

const collectedCount = (view: ConcentrationView): number =>
  view.slots.reduce((n, s) => n + (s.status === "collected" ? 1 : 0), 0);

/** 配り終えた直後（誰もまだ動かしていない）か。全 slot 伏せ・めくり無し・pending 無しで判定。 */
function isFreshDeal(view: ConcentrationView): boolean {
  if (view.phase !== "playing") return false;
  if (view.revealed.length !== 0 || view.pending !== null) return false;
  return view.slots.every((s) => s.status === "facedown" && !s.face);
}

const specialKindOf = (slot: ViewSlot): SpecialKind | null =>
  slot.face?.type === "special" ? slot.face.special.kind : null;

/**
 * 前後の view から鳴らすイベント列を導出する。
 * - prev === null（セッション最初の観測）はベースライン: 配りイベントのみ判定（再接続の一斉再生防止）。
 * - 検出は優先順（special を先に＝revealed をクリアするので flip と競合しない）。1遷移で複数可。
 */
export function diffConcentrationView(
  prev: ConcentrationView | null,
  next: ConcentrationView,
): CAudioEvent[] {
  if (prev === null) {
    return isFreshDeal(next) ? [{ kind: "deal" }] : [];
  }
  // 再戦（#17）: 終局 → 配り直し直後 もシャッフル音を鳴らす。
  if (prev.phase === "ended" && isFreshDeal(next)) {
    return [{ kind: "deal" }];
  }

  const events: CAudioEvent[] = [];
  const prevByPos = new Map(prev.slots.map((s) => [s.pos, s]));

  // 特殊カード発動（used に変わった位置。used slot は face を持つ）。先に判定する。
  let specialThisStep = false;
  for (const s of next.slots) {
    const before = prevByPos.get(s.pos);
    if (before && before.status !== "used" && s.status === "used") {
      const kind = specialKindOf(s);
      if (kind) {
        events.push({ kind: "special", special: kind });
        specialThisStep = true;
      }
    }
  }

  // ペア成立（collected が増えた）。成立は同席継続なので collector = prev.currentSeat。
  const gained = collectedCount(next) - collectedCount(prev);
  if (gained > 0) {
    events.push({ kind: "match", seat: prev.currentSeat });
  }

  // お手つき＝伏せ戻し（resolve 待ちから revealed が空へ・成立も特殊も無し）。
  if (prev.pending?.type === "resolve" && next.revealed.length === 0 && gained === 0 && !specialThisStep) {
    events.push({ kind: "miss" });
  }

  // めくり（revealed に新しく増えた位置。特殊発動は revealed を増やさないので誤検出しない）。
  const prevRevealed = new Set(prev.revealed);
  for (const pos of next.revealed) {
    if (!prevRevealed.has(pos)) events.push({ kind: "flip", pos });
  }

  // 覗き見の私的リビール（facedown かつ非 revealed の slot が新たに face を得た＝発動者だけ）。
  const nextRevealed = new Set(next.revealed);
  for (const s of next.slots) {
    if (s.status !== "facedown" || !s.face || nextRevealed.has(s.pos)) continue;
    const before = prevByPos.get(s.pos);
    if (before && !before.face) events.push({ kind: "peek" });
  }

  // 終局。
  if (prev.phase !== "ended" && next.phase === "ended") {
    events.push({ kind: "end" });
  }

  return events;
}
