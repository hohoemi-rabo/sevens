/**
 * 神経衰弱の特殊カードSVG素材ジェネレータ（フェーズ4A）。
 *
 * public/cards/special/ に 3種（shuffle/swap/peek）の自作SVGを書き出す。
 * シニアの視認性最優先: 大きなアイコン＋日本語ラベル＋高コントラストの色分け。
 * トランプ札（public/cards/*.svg）と同じ 250x350・角丸フレーム。命名は SpecialKind と一致:
 *   src/lib/concentration/cards.ts の SpecialKind = 'shuffle'|'swap'|'peek'。
 *   ファイル名 `${kind}.svg`（UI は /cards/special/${kind}.svg で参照）。
 *
 * 再生成: npm run cards:special
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(SCRIPT_DIR, '../public/cards/special')
const FONT = "'Arial','Helvetica',sans-serif"

/** カードの共通フレーム＋上部バンド＋中央アイコン＋下部ラベル。 */
function specialSvg(accent, iconInner, label) {
  return (
    `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" width="250" height="350">` +
    `<rect x="4" y="4" width="242" height="342" rx="20" ry="20" fill="#ffffff" stroke="#cccccc" stroke-width="3"/>` +
    // 上部バンド（種別を色で示す）
    `<path d="M4 24 a20 20 0 0 1 20 -20 H226 a20 20 0 0 1 20 20 V64 H4 Z" fill="${accent}"/>` +
    `<text x="125" y="46" font-family="${FONT}" font-weight="800" font-size="30" fill="#ffffff" text-anchor="middle">とくべつ</text>` +
    // 中央アイコン
    iconInner +
    // 下部ラベル
    `<text x="125" y="316" font-family="${FONT}" font-weight="800" font-size="40" fill="${accent}" text-anchor="middle">${label}</text>` +
    `</svg>\n`
  )
}

/** 始点→終点の直線＋終点の矢じり。 */
function arrow(x1, y1, x2, y2, color, w = 16) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const h = 30 // 矢じりの大きさ
  const a1 = ang + Math.PI - 0.5
  const a2 = ang + Math.PI + 0.5
  const p1 = `${x2 + h * Math.cos(a1)},${y2 + h * Math.sin(a1)}`
  const p2 = `${x2 + h * Math.cos(a2)},${y2 + h * Math.sin(a2)}`
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<polygon points="${x2},${y2} ${p1} ${p2}" fill="${color}"/>`
  )
}

// shuffle: 交差する2本の矢印（入れ替わる様子）。
const SHUFFLE = '#e67e22'
const shuffleIcon = `<g>${arrow(70, 150, 182, 232, SHUFFLE)}${arrow(70, 232, 182, 150, SHUFFLE)}</g>`

// swap: 水平の双方向矢印（2枚の位置を入れ替える）。
const SWAP = '#16a085'
const swapIcon = `<g>${arrow(125, 190, 66, 190, SWAP)}${arrow(125, 190, 184, 190, SWAP)}</g>`

// peek: 目（1枚だけ中身を見る）。
const PEEK = '#8e44ad'
const peekIcon =
  `<path d="M45 190 Q125 118 205 190 Q125 262 45 190 Z" fill="none" stroke="${PEEK}" stroke-width="14"/>` +
  `<circle cx="125" cy="190" r="34" fill="${PEEK}"/>` +
  `<circle cx="113" cy="178" r="11" fill="#ffffff"/>`

const CARDS = {
  shuffle: specialSvg(SHUFFLE, shuffleIcon, 'シャッフル'),
  swap: specialSvg(SWAP, swapIcon, 'いれかえ'),
  peek: specialSvg(PEEK, peekIcon, 'のぞき見'),
}

// --- 生成 ---
mkdirSync(OUT_DIR, { recursive: true })
for (const [kind, svg] of Object.entries(CARDS)) {
  writeFileSync(resolve(OUT_DIR, `${kind}.svg`), svg)
}

// --- 検証（整形式SVG・命名・枚数） ---
const expected = ['shuffle.svg', 'swap.svg', 'peek.svg'].sort()
const actual = readdirSync(OUT_DIR).filter((f) => f.endsWith('.svg')).sort()
const missing = expected.filter((f) => !actual.includes(f))
const extra = actual.filter((f) => !expected.includes(f))
const malformed = actual.filter((f) => {
  const svg = readFileSync(resolve(OUT_DIR, f), 'utf8')
  return !svg.startsWith('<svg') || !svg.includes('</svg>')
})
if (missing.length || extra.length || malformed.length) {
  console.error('NG:', { missing, extra, malformed })
  process.exit(1)
}
console.log(`OK: generated ${actual.length} special-card SVGs in public/cards/special/`)
