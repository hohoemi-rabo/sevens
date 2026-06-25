# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**sevens** は、ほほ笑みラボ（シニア向けパソコン・スマホ教室）の生徒さん向けに、教室内LANで遊ぶ **4人対戦「7並べ」** ゲーム。詳細な仕様は `REQUIREMENTS.md` に定義されている（実装着手前は必ず参照すること）。

設計上の重要な制約・方針:
- **シニアファースト**: 大きな文字・ボタン（最小タップ領域60×60px）、高コントラスト、誤操作リカバリ、「待って」「出す前確認」ボタン
- **PC横長画面を最優先**で最適化（タブレットはレスポンシブ対応）
- **記録・保存なし / DB不要**: 状態はメモリ上のみ。永続化する個人情報は名前のみ
- **クラウド不要**: ホストPC1台＋教室内Wi-Fiで完結（インターネット前提にしない）
- 既存の麻雀ゲームの技術資産（通信層・部屋管理・CPU・お助けモード・音声）を流用する方針

## コマンド

```bash
npm run dev     # 開発サーバー（Turbopack使用、http://localhost:3000）
npm run build   # 本番ビルド（Turbopack使用）
npm run start   # ビルド済みアプリの起動
npm run lint    # ESLint（next/core-web-vitals + next/typescript）
```

テストフレームワークは未導入。`REQUIREMENTS.md` フェーズ2でゲームルールの単体テストを追加予定。

## 技術スタック

- **Next.js 15 (App Router) + React 19 + TypeScript** — Turbopack有効
- **Tailwind CSS v3.4**（v4ではなく意図的にv3。`tailwind.config.ts` + `postcss.config.mjs`）
- **Zustand**（状態管理・未導入）、**Socket.io**（通信・未導入）
- パスエイリアス: `@/*` → `./src/*`
- 現状は `create-next-app` のボイラープレートのみ（`src/app/` に layout/page/globals.css）

## アーキテクチャ（実装方針）

`REQUIREMENTS.md` 第7章が正。**3層に明確分離**する:

1. **UI層**（Next.js / React, `src/app`・`src/components`）
2. **ゲームロジック層**（純粋TS, `src/lib/sevens/`）— 通信に一切依存しない純関数群。配札・場の管理・出せる札判定・パス/脱落管理・順位判定・CPU思考（弱/中/強の3段階を別ファイルで実装）
3. **通信層**（差し替え可能, `src/lib/adapter/`）— `LocalAdapter`（Socket.io 同一LAN, 麻雀から流用）を実装。将来 `RemoteAdapter` を追加できる抽象を維持

**この分離を崩さないこと**: ゲームロジックは通信・UIをimportしない。これにより単体テストとアダプタ差し替えが可能になる。

Socket.ioを使うため、Next.jsと同居するカスタムサーバー `server.ts` を導入予定（イベント例: `room:create`, `game:state`, `player:play`, `player:pass`, `player:eliminated` 等）。

## ゲームルールの要点（実装時の注意）

- トランプ52枚（ジョーカーなし）を4人で均等配分（各13枚）。CPUで4人を埋める
- ♦7からスタート、7を起点に各スート両方向（8→K / 6→A）へ伸ばす
- **パス回数はホストが部屋作成時に設定（1〜5回）**。超過したら手札を全て場に出して**脱落**
- 順位は1〜4位＋脱落を明示。全員が上がるか脱落するまで継続
- **お助けモード**（デフォルトON、トグル切替）: 出せる札ハイライト、出せる札があるのにパスする際の警告ダイアログ、残りパス回数強調、ターン通知

## Next.js App Router ベストプラクティス（15.5系）

context7 で取得した公式ドキュメント（Next.js 15.x App Router）に基づく方針。本プロジェクトで実装する際は以下に従う。

### Server / Client コンポーネントの境界
- **デフォルトは Server Component**。`page.tsx`・`layout.tsx` 含め、`app/` 配下は明示しない限りサーバー側で動く
- `"use client"` は**ツリーの葉（リーフ）にできるだけ近い場所**に置く。境界を上に置くほどクライアントJSバンドルが肥大化する。インタラクティブな最小単位（ボタン・トグル・手札カードなど）だけをClient Component化する
- **Client Component には Server Component を `children`/props として渡せる**。状態を持つUIラッパー（例: お助けトグルやモーダル）を Client にし、その中身は Server のまま流し込む構成にすると、サーバー側レンダリングを保てる

  ```tsx
  // page.tsx (Server Component)
  export default function Page() {
    return (
      <ClientShell>      {/* "use client" */}
        <ServerContent /> {/* サーバーのまま描画される */}
      </ClientShell>
    )
  }
  ```

  逆に Client Component が Server Component を **import** することはできない。

### Next.js 15 の重要な変更（必ず守る）
- **リクエストAPIは非同期**: `cookies()`, `headers()`, `draftMode()`、および `page`/`layout` の `params`・`searchParams` は **Promise を返すので `await` する**。
  ```tsx
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
  }
  ```
- これらのリクエスト依存APIを使うコンポーネントは `<Suspense>` で包み、データ取得は**それを実際に消費する子コンポーネントの中**で行う（親に持ち上げない）。ストリーミングと部分レンダリングが効く。

### データ取得とキャッシュ
- データ取得は **Server Component 内で直接 `async/await`** する。クライアントへ生データを渡す場合のみ props で渡す
- `fetch` のキャッシュ戦略を明示する:
  - `{ cache: 'force-cache' }`（デフォルト）— 静的・手動無効化まで保持
  - `{ cache: 'no-store' }` — リクエスト毎に再取得（動的）
  - `{ next: { revalidate: N } }` — N秒のISR
- **本プロジェクトはDB・永続化なし**でメモリ上の状態管理が中心のため、`fetch` キャッシュより **Socket.io 経由のリアルタイム状態同期 + Zustand** が主役になる。サーバー由来の静的データ（カード定義など）だけ Server Component で扱う想定。

### Server Actions / フォーム
- フォーム送信・サーバー側バリデーションは **Server Actions** を使う
- Client 側はエラー表示と pending 状態に `useActionState` を使う（`const [state, formAction, pending] = useActionState(action, initialState)`）

### ファイル規約・プロジェクト構成
- ルートごとに `loading.tsx`（Suspense フォールバック）と `error.tsx`（Client Component必須・`reset()` でリカバリ）を用意し、ローディング/エラー境界を明示する。ルートレイアウトのエラーは `global-error.tsx`（`<html>`/`<body>` を含める）
- メタデータは `metadata` エクスポートまたは `generateMetadata` で定義する（`<head>` を手書きしない）
- コロケーション可能。ルーティングに含めたくない補助ファイルは**プライベートフォルダ `_folder`**（例: `_components`, `_lib`）に置けば URL セグメントにならない。ただし本プロジェクトの共有ロジックは `REQUIREMENTS.md` 方針どおり `src/lib/` 配下に集約する

## アセット

- トランプカードは**SVGで自作**し `public/cards/` に配置（命名: `s1〜s13`=スペードA〜K, `h*`=ハート, `d*`=ダイヤ, `c*`=クラブ, `back.svg`=裏面）
- 音声・効果音は `public/audio/`、mp3を事前ロード。読み上げ（「ダイヤの8！」等）・拍手音・シャッフル音など「ワイワイ感」が中心機能
