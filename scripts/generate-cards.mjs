/**
 * トランプカードSVG素材ジェネレータ（チケット04）。
 *
 * public/cards/ に 52枚＋裏面(back.svg) の自作SVGを書き出す。
 * シニアの視認性最優先: 四隅に大きなランク＋中央に大きなスート1つ。赤黒を高コントラストに。
 *
 * 命名規則は src/lib/sevens/cards.ts の `cardId`（例 d7）と一致させること:
 *   スート s(スペード)/h(ハート)/d(ダイヤ)/c(クラブ)、ランク 1(A)〜13(K)。
 *   ファイル名 `${suit}${rank}.svg`。h と d が赤（cards.ts の isRedSuit と対応）。
 *
 * 再生成: npm run cards:generate
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(SCRIPT_DIR, '../public/cards')

// cards.ts の Suit と一致。h/d が赤。
const SUITS = ['s', 'h', 'd', 'c']
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
const RED = '#d40000'
const BLACK = '#1a1a1a'
const FONT = "'Arial','Helvetica',sans-serif"

const colorOf = (suit) => (suit === 'h' || suit === 'd' ? RED : BLACK)

// 1(A)/11(J)/12(Q)/13(K) は英字、それ以外は数字。cards.ts の RANKS に対応。
const rankLabel = (rank) =>
  ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] ?? String(rank)

/**
 * スートのシンボルを 0..100 のローカル座標で描く（中心は約 50,50）。
 * 塗り色を受け取り、外側で transform して拡大・配置する（フォント非依存・自己完結）。
 */
function suitShape(suit, fill) {
  switch (suit) {
    case 'd':
      return `<path d="M50 4 L86 50 L50 96 L14 50 Z" fill="${fill}"/>`
    case 'h':
      return `<path d="M50 86 C18 58 8 39 8 27 C8 13 23 7 35 14 C42 18 47 23 50 29 C53 23 58 18 65 14 C77 7 92 13 92 27 C92 39 82 58 50 86 Z" fill="${fill}"/>`
    case 's':
      return (
        `<path d="M50 14 C82 42 92 61 92 73 C92 87 77 93 65 86 C58 82 53 77 50 71 C47 77 42 82 35 86 C23 93 8 87 8 73 C8 61 18 42 50 14 Z" fill="${fill}"/>` +
        `<path d="M50 64 C48 78 44 86 36 92 L64 92 C56 86 52 78 50 64 Z" fill="${fill}"/>`
      )
    case 'c':
      return (
        `<circle cx="50" cy="28" r="18" fill="${fill}"/>` +
        `<circle cx="31" cy="54" r="18" fill="${fill}"/>` +
        `<circle cx="69" cy="54" r="18" fill="${fill}"/>` +
        `<path d="M50 50 C48 70 44 84 36 92 L64 92 C56 84 52 70 50 50 Z" fill="${fill}"/>`
      )
    default:
      throw new Error(`Unknown suit: ${suit}`)
  }
}

/** 四隅インデックス（ランク＋小スート）。bottom-right は中心まわり180°回転で配置。 */
function cornerIndex(suit, rank) {
  const color = colorOf(suit)
  const label = rankLabel(rank)
  const rankFont = label === '10' ? 44 : 56
  const group =
    `<text x="32" y="62" font-family="${FONT}" font-weight="700" font-size="${rankFont}" fill="${color}" text-anchor="middle">${label}</text>` +
    `<g transform="translate(18,70) scale(0.30)">${suitShape(suit, color)}</g>`
  return `<g>${group}</g><g transform="rotate(180 125 175)">${group}</g>`
}

/** 中央の意匠。数札・Aは大スート1つ、絵札(J/Q/K)は大きな英字＋上に中スート。 */
function center(suit, rank) {
  const color = colorOf(suit)
  if (rank >= 11) {
    return (
      `<g transform="translate(95,40) scale(0.6)">${suitShape(suit, color)}</g>` +
      `<text x="125" y="232" font-family="${FONT}" font-weight="800" font-size="150" fill="${color}" text-anchor="middle">${rankLabel(rank)}</text>`
    )
  }
  return `<g transform="translate(65,115) scale(1.2)">${suitShape(suit, color)}</g>`
}

function cardSvg(suit, rank) {
  return (
    `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" width="250" height="350">` +
    `<rect x="4" y="4" width="242" height="342" rx="20" ry="20" fill="#ffffff" stroke="#cccccc" stroke-width="3"/>` +
    cornerIndex(suit, rank) +
    center(suit, rank) +
    `</svg>\n`
  )
}

function backSvg() {
  return (
    `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" width="250" height="350">` +
    `<defs>` +
    `<pattern id="back" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="28" height="28" fill="#1f4e79"/>` +
    `<circle cx="14" cy="14" r="5" fill="#3a6ea5"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect x="4" y="4" width="242" height="342" rx="20" ry="20" fill="#ffffff" stroke="#cccccc" stroke-width="3"/>` +
    `<rect x="16" y="16" width="218" height="318" rx="12" fill="url(#back)"/>` +
    `<rect x="16" y="16" width="218" height="318" rx="12" fill="none" stroke="#ffffff" stroke-width="5"/>` +
    `</svg>\n`
  )
}

// --- 生成 ---
mkdirSync(OUT_DIR, { recursive: true })
const written = []
for (const suit of SUITS) {
  for (const rank of RANKS) {
    const name = `${suit}${rank}.svg`
    writeFileSync(resolve(OUT_DIR, name), cardSvg(suit, rank))
    written.push(name)
  }
}
writeFileSync(resolve(OUT_DIR, 'back.svg'), backSvg())
written.push('back.svg')

// --- 検証（整形式SVG・命名・枚数） ---
const expected = [
  ...SUITS.flatMap((s) => RANKS.map((r) => `${s}${r}.svg`)),
  'back.svg',
]
const actual = readdirSync(OUT_DIR).filter((f) => f.endsWith('.svg')).sort()
const expectedSorted = [...expected].sort()

const missing = expectedSorted.filter((f) => !actual.includes(f))
const extra = actual.filter((f) => !expectedSorted.includes(f))
let malformed = []
for (const f of actual) {
  const svg = readFileSync(resolve(OUT_DIR, f), 'utf8')
  if (!svg.startsWith('<svg') || !svg.includes('</svg>')) malformed.push(f)
}

if (missing.length || extra.length || malformed.length) {
  console.error('NG:', { missing, extra, malformed })
  process.exit(1)
}
console.log(`OK: generated ${written.length} SVG files in public/cards/ (52 cards + back)`)
