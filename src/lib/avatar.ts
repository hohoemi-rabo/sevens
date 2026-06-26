/**
 * アバター割当（純粋TS）。
 *
 * プレイヤーの席番号から、生成済みアバターSVG（public/avatars/a0..a3.svg）のパスを返す。
 * 素材は scripts/generate-avatars.mjs で生成（`npm run avatars:generate`）。
 * 名前は別途表示し、アバターは席で決まる装飾（記録・個人情報には使わない）。
 */

/** 生成済みアバターの種類数（a0..a3）。generate-avatars.mjs と一致させること。 */
export const AVATAR_COUNT = 4

/** 席番号 → アバターSVGのパス（席は 0..3 想定、範囲外も剰余で安全に丸める）。 */
export function avatarSrcForSeat(seat: number): string {
  const i = ((Math.trunc(seat) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT
  return `/avatars/a${i}.svg`
}
