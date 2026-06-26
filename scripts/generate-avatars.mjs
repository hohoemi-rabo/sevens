/**
 * プレイヤーアバターSVG素材ジェネレータ（チケット16）。
 *
 * public/avatars/ に 4種（a0.svg〜a3.svg）の親しみやすい丸顔キャラを書き出す。
 * 席番号で割り当てる（src/lib/avatar.ts の avatarSrcForSeat と一致＝`/avatars/a${seat%4}.svg`）。
 * シニア向けに高コントラスト・はっきりした表情。トランプ生成（generate-cards.mjs）と同方式。
 *
 * 再生成: npm run avatars:generate
 */
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(SCRIPT_DIR, '../public/avatars')

// 席ごとのキャラ設定（顔の色・髪/帽子の色・アクセント・表情）。4人ぶん。
const FACES = [
  { skin: '#ffd9a0', hair: '#e94f37', accent: '#c63a26', cheek: '#ff9d8a', kind: 'bob' }, // 0: 赤毛ボブ
  { skin: '#f6c89a', hair: '#3a6ea5', accent: '#2b5580', cheek: '#ff9d8a', kind: 'cap' }, // 1: 青帽子
  { skin: '#ffd9a0', hair: '#6b4f2a', accent: '#4f3a1e', cheek: '#ff9d8a', kind: 'short' }, // 2: 茶髪ショート
  { skin: '#f6c89a', hair: '#5a8f3c', accent: '#436b2c', cheek: '#ff9d8a', kind: 'bun' }, // 3: 緑お団子
]

// 背景の淡い色（席ごとに変えて見分けやすく）。
const BG = ['#fde7e2', '#e2edf7', '#f1ebe0', '#e7f2e0']

const STROKE = '#3a2e2a'

/** 髪型/帽子を描く（顔の上に重ねる）。viewBox 0..120 のローカル座標。 */
function hairShape(kind, hair, accent) {
  switch (kind) {
    case 'bob':
      return (
        `<path d="M22 56 C22 28 44 16 60 16 C76 16 98 28 98 56 C98 44 86 34 60 34 C34 34 22 44 22 56 Z" fill="${hair}"/>` +
        `<path d="M22 56 C18 70 20 84 24 92 L34 92 C28 78 28 64 30 54 Z" fill="${hair}"/>` +
        `<path d="M98 56 C102 70 100 84 96 92 L86 92 C92 78 92 64 90 54 Z" fill="${hair}"/>`
      )
    case 'cap':
      return (
        `<path d="M24 50 C24 26 46 16 60 16 C74 16 96 26 96 50 Z" fill="${hair}"/>` +
        `<rect x="20" y="48" width="80" height="10" rx="5" fill="${accent}"/>` +
        `<circle cx="60" cy="20" r="6" fill="${accent}"/>`
      )
    case 'short':
      return `<path d="M24 54 C24 28 44 16 60 16 C76 16 96 28 96 54 C90 42 80 34 60 34 C40 34 30 42 24 54 Z" fill="${hair}"/>`
    case 'bun':
      return (
        `<circle cx="60" cy="14" r="10" fill="${hair}"/>` +
        `<path d="M24 54 C24 28 44 18 60 18 C76 18 96 28 96 54 C90 42 80 34 60 34 C40 34 30 42 24 54 Z" fill="${hair}"/>`
      )
    default:
      throw new Error(`Unknown hair kind: ${kind}`)
  }
}

function avatarSvg(i) {
  const f = FACES[i]
  const bg = BG[i]
  return (
    `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="120" height="120">` +
    `<circle cx="60" cy="60" r="58" fill="${bg}" stroke="#ffffff" stroke-width="4"/>` +
    // 顔
    `<circle cx="60" cy="62" r="34" fill="${f.skin}" stroke="${STROKE}" stroke-width="2"/>` +
    // ほっぺ
    `<circle cx="42" cy="70" r="6" fill="${f.cheek}" opacity="0.7"/>` +
    `<circle cx="78" cy="70" r="6" fill="${f.cheek}" opacity="0.7"/>` +
    // 目
    `<circle cx="49" cy="60" r="4.5" fill="${STROKE}"/>` +
    `<circle cx="71" cy="60" r="4.5" fill="${STROKE}"/>` +
    // 笑った口
    `<path d="M50 74 C55 82 65 82 70 74" fill="none" stroke="${STROKE}" stroke-width="3" stroke-linecap="round"/>` +
    // 髪/帽子（最後に重ねる）
    hairShape(f.kind, f.hair, f.accent) +
    `</svg>\n`
  )
}

// --- 生成 ---
mkdirSync(OUT_DIR, { recursive: true })
const written = []
for (let i = 0; i < FACES.length; i++) {
  const name = `a${i}.svg`
  writeFileSync(resolve(OUT_DIR, name), avatarSvg(i))
  written.push(name)
}

// --- 検証（整形式SVG・命名・枚数） ---
const expected = FACES.map((_, i) => `a${i}.svg`).sort()
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
console.log(`OK: ${written.length} avatars -> public/avatars/`)
