# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**sevens** は、ほほ笑みラボ（シニア向けパソコン・スマホ教室）の生徒さん向けに、教室内LANで遊ぶ **4人対戦「7並べ」** ゲーム。詳細な仕様は `REQUIREMENTS.md` に定義されている（実装着手前は必ず参照すること）。

設計上の重要な制約・方針:
- **シニアファースト**: 大きな文字・ボタン（最小タップ領域60×60px）、高コントラスト、誤操作リカバリ、「待って」「出す前確認」ボタン
- **PC横長画面を最優先**で最適化（タブレットはレスポンシブ対応）
- **記録・保存なし / DB不要**: ゲーム状態はサーバーのメモリ上のみ（永続化する個人情報は名前のみ）。例外として再接続用の `roomId/seat/token` を各端末の **sessionStorage** に保持するが、タブを閉じると破棄され、ゲーム記録は一切残さない（チケット13）
- **クラウド不要**: ホストPC1台＋教室内Wi-Fiで完結（インターネット前提にしない）
- 既存の麻雀ゲームの技術資産（通信層・部屋管理・CPU・お助けモード・音声）を流用する方針

## 開発チケットと Todo 管理

開発タスクは `REQUIREMENTS.md` を機能・要件ごとに分割した **`docs/` 配下のチケット**で管理する。`docs/00-overview.md` がインデックス（フェーズ1〜5、依存順）。各チケットは番号順（＝依存関係順）に進める。

**Todo 運用ルール（厳守）**:
- 各チケット内のタスクは Markdown のチェックボックス `- [ ]` で管理する
- **完了したら `- [ ]` を `- [x]` に変更する**（チェック済みを表す）
- `docs/00-overview.md` のチケット一覧自体も同じ運用。チケットを完了したら overview 側のチェックも `- [x]` にする
- 作業を進めたら、該当チケットの Todo と overview のチェック状態を必ず更新する

**進捗（最新の正は `docs/00-overview.md`）**:
- ✅ フェーズ1（01〜06）: ゲームロジック土台＋ローカル単独でCPU対戦が動く
- ✅ フェーズ2（07〜09）: ルール完成（パス/脱落・順位）＋ロジック層の単体テスト整備
- ✅ チケット10: 通信層（`server.ts`＋`src/lib/adapter/`＋`src/lib/server/session.ts`＋`src/lib/store/`）。サーバー権威の RoomStore・LocalAdapter・Zustand ストアを実装し、in-process 結合テストで複数クライアント同期を機械保証
- ✅ チケット11: 部屋作成・合言葉入室・QR・席割りUI。トップ（`/`）→`/host`（合言葉/QR/パス回数/CPU強さ/開始）→`/join`（合言葉＋名前）→`/room/[id]`（ネットワーク版 `GameBoard`）。「ひとりで遊ぶ」1タップ導線あり
- ✅ チケット12: CPU難易度（弱/中/強の思考）。`cpu/{weak,medium,strong}.ts`＋`heuristics.ts`、`strategyFor` で解決。中＝自分中心、強＝相手の手札を読む（アバター素材・表示は#16/#17へ）
- ✅ チケット13: 切断・再接続。サーバー側シーム（#10）に加え、入室セッション（`roomId/seat/token`）を sessionStorage 永続化＋リロード時に再水和して自動再接続。切断中はバナー表示。**フェーズ3完了**
- ✅ チケット14: 音声・効果音。読み上げ＝Web Speech API（録音不要・動的）、効果音＝`public/audio/` の mp3（固定名・未配置でも無音フォールバック）。`game:state` の前後差分（`diffGameState`）でイベント検出し `useAudioEffects` が再生。音量/ミュートは `audioStore`（sessionStorage 永続・端末ごと）
- ✅ チケット15: お助けモード。右上トグル（`HelpToggle`）で切替・デフォルトON・端末ごと保持（`helpStore`＋`help-settings-storage.ts`／sessionStorage）。ON＝出せる札ハイライト＋無駄パス確認ダイアログ（`PassWarningDialog`）＋残パス強調＋ターン通知強（`TurnBanner`）、OFF＝強調なし・全札選択可・即パス。判定は既存純関数（`playableCards`/`hasPlayable`）を再利用
- ✅ チケット16: PC横長レイアウト・シニアUI仕上げ。場は A〜K 13列固定・7中央基準（`Board.tsx`）、相手はアバター＋残枚数/残パス＋切断中/CPU表示（`OpponentArea.tsx`＋`gameStore.players`を席引き当て）。アバターはSVG生成（`scripts/generate-avatars.mjs`→`public/avatars/`・席割当 `src/lib/avatar.ts`）。左上`GameMenu`に「出す前確認」（`uiSettingsStore`・既定ON）＋トップへ戻る、「待って」はローカル演出。確認系は汎用 `ui/ConfirmDialog`に統一（`PassWarningDialog`も委譲）。`Card` に hover 強調
- ✅ チケット17: 結果画面（`ResultScreen.tsx`）。順位（金銀銅）＋脱落＋「あなた」を大きく表示。**もう一回/解散（ホスト限定）のプロトコルを追加**: `game:rematch`/`room:dissolve`（server.ts）、`RoomStore.rematch`（`dealInto` 抽出・同席/同設定/新seed）、`SevensAdapter.rematch/dissolve/onDissolved`、`gameStore.rematch/dissolve/dissolved`。解散は全員トップへ。session/sync テストで機械保証。**フェーズ4完了**
- ▶ フェーズ1〜4 完了。残りはフェーズ5（#18 将来拡張：ジョーカー/ローカルルール/クラウド・必要時）
- 1チケット完了ごとにコンベンショナルコミット。各チケットの実装方針・確定事項はコミット履歴と本ファイル下部「確定済み設計判断」を参照

## コマンド

```bash
npm run dev            # カスタムサーバー起動（tsx watch server.ts、Next dev は内部で Turbopack）http://localhost:3000
npm run build          # 本番ビルド（next build --turbopack）
npm run start          # 本番起動（NODE_ENV=production tsx server.ts。next start は使わない）
npm run lint           # ESLint（next/core-web-vitals + next/typescript）
npm run test           # Vitest（watch）
npm run test:run       # Vitest（1回実行・CI/検証用）
npm run test:coverage  # Vitest + カバレッジ（@vitest/coverage-v8、src/lib/{sevens,adapter,server}/** 対象）
npm run cards:generate # トランプSVG 53枚を public/cards/ に再生成
npm run avatars:generate # プレイヤーアバターSVG 4枚を public/avatars/ に再生成
```

**カスタムサーバー（チケット10〜）**: Socket.io と Next.js を同居させるため `server.ts`（`tsx` 実行）が起点。`dev` は `tsx watch server.ts`（server.ts 編集時はプロセス再起動＝全 socket 切断、再接続は#13）。ページの HMR は `next({dev,turbopack:dev})` が従来どおり提供。LAN 公開のため `host=0.0.0.0`（`HOST`/`PORT`/`CPU_DELAY_MS` env で上書き可）。`next.config.ts` の `allowedDevOrigins` で他端末からの dev アクセスを許可。

**テストは Vitest を導入済み**（node 環境・`vitest.config.ts`、`@/*` エイリアス対応）。ゲームロジック層には各ファイル隣接の `*.test.ts` で振る舞いベースのテストを置く方針。シャッフルは `seededRng`（`deal.ts`）でシード固定し決定論的にテストする。

## 技術スタック

- **Next.js 15 (App Router) + React 19 + TypeScript** — Turbopack有効
- **Tailwind CSS v3.4**（v4ではなく意図的にv3。`tailwind.config.ts` + `postcss.config.mjs`）
- **Vitest**（テスト・導入済み）
- **Zustand**（状態管理・導入済み, `src/lib/store/`）、**Socket.io**（通信・導入済み, server/client）、**tsx**（カスタムサーバー実行）
- パスエイリアス: `@/*` → `./src/*`

### 現在のディレクトリ構成（実装済み）
- `src/lib/sevens/` — ゲームロジック層（純粋TS）: `cards.ts` / `deal.ts` / `board.ts` / `playable.ts` / `pass.ts` / `state.ts` / `ranking.ts` と `cpu/`（`types.ts`＝`CpuStrategy`/`CpuStrength` / `weak.ts` / `medium.ts` / `strong.ts` / `heuristics.ts` / `index.ts`＝`strategyFor`）。各ファイルに `*.test.ts`
- `src/components/game/` — 対局UI: `GameBoard.tsx`（`/room/[id]` のネットワーク版オーケストレータ・`gameState` 購読）/ `Board.tsx` / `HandCards.tsx` / `ActionButtons.tsx` / `OpponentArea.tsx` / `Card.tsx`
- `src/components/room/` — 部屋フロー: `HostScreen.tsx`／`HostLobby.tsx`／`JoinScreen.tsx`／`PlayerList.tsx`／`SoloStartButton.tsx`／`QrCode.tsx`／`useServerInfo.ts`／`useGotoRoomOnStart.ts`
- `src/components/ui/` — シニアUIキット: `Button.tsx`（`buttonVariants`・タップ60px）/ `Input.tsx` / `Heading.tsx` / `ScreenContainer.tsx` / `ConfirmDialog.tsx`（汎用確認モーダル・#16）/ `index.ts`
- `src/components/audio/` — 音声UI: `AudioControls.tsx`（音量スライダー＋ミュート・`audioStore` 購読）/ `index.ts`
- `src/components/help/` — お助けモードUI（#15）: `HelpToggle.tsx`（ON/OFFトグル）/ `PassWarningDialog.tsx`（無駄パス確認＝`ui/ConfirmDialog`へ委譲）/ `TurnBanner.tsx`（ターン通知・残パス強調）/ `index.ts`
- 対局UI追加（#16）: `src/components/game/` に `Avatar.tsx`（席→SVGアバター）/ `GameMenu.tsx`（左上メニュー・出す前確認トグル＋トップへ戻る）。`Board.tsx`=A〜K13列7中央、`OpponentArea.tsx`=アバター/接続表示、`ActionButtons.tsx`=パス/自分アバター+待って/出すの操作バー
- 結果画面（#17）: `src/components/game/ResultScreen.tsx`（順位/脱落一覧・もう一回/解散/退出）
- `src/lib/audio/` — 音声層（#14）: `events.ts`（`diffGameState`＝状態差分→音イベントの純関数）＋`events.test.ts` / `speech.ts`（Web Speech API 読み上げ）/ `sfx.ts`（mp3 効果音・未配置で無音）/ `unlock.ts`（自動再生解禁）/ `useAudioEffects.ts`（gameState 購読→再生フック）
- `src/app/` — `layout.tsx`（`lang="ja"`・metadata）/ `page.tsx`（トップメニュー）/ `host/page.tsx` / `join/page.tsx`（`await searchParams`）/ `room/[id]/page.tsx`（`await params`）/ `api/server-info/route.ts`（LAN URL）/ `globals.css`
- `public/cards/` — トランプSVG 53枚（`scripts/generate-cards.mjs` で生成）
- `public/audio/` — 効果音mp3（固定名・ユーザー配置・未配置でも無音）。`README.md` に期待ファイル名と仕様
- `public/avatars/` — プレイヤーアバターSVG 4枚（`scripts/generate-avatars.mjs` で生成・席番号で割当）
- `server.ts`（ルート） — Next.js + Socket.io 同居のカスタムサーバー。RoomStore を権威に socket イベントを捌くグルー（ルールは持たない）
- `src/lib/adapter/` — 通信層: `types.ts`（`SevensAdapter` 契約）/ `local.ts`（`LocalAdapter`・Socket.io）/ `remote.ts`（将来スタブ）/ `connect.ts`（`ensureConnected`）。`local.test.ts` / `sync.test.ts`（in-process 結合）
- `src/lib/server/` — `session.ts`（`RoomStore`＝サーバー権威の部屋・席・状態管理）と `session.test.ts`
- `src/lib/store/` — Zustand: `gameStore.ts`（サーバー同期ストア）/ `useGameConnection.ts`（接続フック・再水和）/ `session-storage.ts`（入室セッションの sessionStorage 永続化）/ `audioStore.ts`＋`audio-settings-storage.ts`（音量・ミュート／sessionStorage）/ `helpStore.ts`＋`help-settings-storage.ts`（お助けモード／sessionStorage）/ `uiSettingsStore.ts`＋`ui-settings-storage.ts`（出す前確認など／sessionStorage）。`gameStore.test.ts` / `session-storage.test.ts`
- `src/lib/avatar.ts` — 席番号→アバターSVGパス（`avatarSrcForSeat`）。`avatar.test.ts`
- `src/lib/cn.ts` — Tailwind クラス結合の最小ヘルパ

## アーキテクチャ（実装方針）

`REQUIREMENTS.md` 第7章が正。**3層に明確分離**する:

1. **UI層**（Next.js / React, `src/app`・`src/components`）
2. **ゲームロジック層**（純粋TS, `src/lib/sevens/`）— 通信に一切依存しない純関数群。配札・場の管理・出せる札判定・パス/脱落管理・順位判定・CPU思考（弱/中/強の3段階を別ファイルで実装）
3. **通信層**（差し替え可能, `src/lib/adapter/`）— `LocalAdapter`（Socket.io 同一LAN, 麻雀から流用）を実装済み。将来 `RemoteAdapter` を追加できる抽象（`SevensAdapter` 契約）を維持

**この分離を崩さないこと**: ゲームロジック（`src/lib/sevens/**`）は通信・UIをimportしない（片方向依存）。これにより単体テストとアダプタ差し替えが可能になる。通信層→ロジックの import のみ許可。

### 通信プロトコル（確定・チケット10で実装）
サーバー（`server.ts` + `RoomStore`）がゲーム状態の**権威**。クライアントは操作を送り `game:state` を受けて描画する（楽観適用しない）。Socket.io イベント:

| イベント | 実装 | 方向 | ペイロード |
|---|---|---|---|
| `room:create` / `room:join` | ack 付き emit | C→S | req `{name}` / `{passcode,name}`、ack `SeatAssignment`\|`AdapterError` |
| `room:reconnect` | ack 付き emit（#13） | C→S | req `{roomId,seat,token}` |
| `room:players` | broadcast | S→C | `PlayerInfo[]` |
| `game:start` | ack 付き emit（host限定） | C→S | req `{opts?: {seed,maxPass,startMode,fillWithCpu,cpuStrength}}` |
| `game:rematch` | ack 付き emit（host限定・#17） | C→S | req `{}`（同席/同設定/新seedで再配札） |
| `room:dissolve` | ack 付き emit（host限定・#17） | C→S | req `{}` |
| `room:dissolved` | broadcast（#17） | S→C | （なし。全員トップへ） |
| `game:state` | broadcast（唯一の同期経路） | S→C | `GameState` |
| `player:play` / `player:pass` | fire-and-forget（エラーは `app:error`） | C→S | `{card}` / `{}` |
| `player:finish` / `player:eliminated` | broadcast（状態 diff から導出・演出用） | S→C | `{seat,rank}` / `{seat,eliminatedOrder}` |
| `game:end` | broadcast（`phase==='ended'` 時） | S→C | `GameState` |
| `app:error` | emit（"error" 予約回避） | S→C | `AdapterError` |

席はサーバー束縛（`socket.data.seat`）を使い、自己申告 seat は信用しない。`player:play` のペイロードは card のみ。

## ゲームルールの要点（実装時の注意）

- トランプ52枚（ジョーカーなし）を4人で均等配分（各13枚）。CPUで4人を埋める
- ♦7からスタート、7を起点に各スート両方向（8→K / 6→A）へ伸ばす。開始方式は `diamond7`（♦7のみ）/ `all7`（各スートの7）を `StartMode` で切替（`board.ts`）
- **パス回数はホストが部屋作成時に設定（1〜5回）**。超過したら手札を全て場に出して**脱落**
- 順位は1〜4位＋脱落を明示。全員が上がるか脱落するまで継続
- **お助けモード**（デフォルトON、トグル切替）: 出せる札ハイライト、出せる札があるのにパスする際の警告ダイアログ、残りパス回数強調、ターン通知（判定は `pass.ts` の `isWastefulPass` 等で公開済み）

### 実装上の確定済み設計判断（変更時は影響を確認）
- **盤面モデル**: `BoardState = Record<Suit, Rank[]>`（配置済みランクの**配列**・昇順・JSON安全）。脱落者の手札を本来ルール通り場に放出すると**隙間（飛んだ札）**が生じるため、`{low,high}` 連続範囲ではなく集合で保持する。出せる札の判定は `runAround7()`（7を含む連続ブロックの端のみ）。一括放出は `placeForced()`
- **脱落**: パス上限超過で `placeForced` により手札を場へ放出し `status:'eliminated'`、`eliminatedOrder` を記録（順位 `rank` とは別枠）。手番送り（`advanceTurn`）は `status==='playing'` 以外を自動スキップ
- **順位**: `ranking.ts` の `computeStandings()` が派生（状態は変更しない）。上がり→`rank` 昇順、脱落→`eliminatedOrder` 降順（後に脱落＝長く生存が上）。脱落者は数字を付けず「脱落」表示
- **ハイドレーション**: 配札は `Math.random` を使うため SSR と不一致になる。`GameTable` は**クライアントのマウント後に `initGame`** し、SSR中は決定的なプレースホルダを描画する（`useState(null)` + `useEffect`）
- **状態は純粋データ**（関数・クラスを持たない）。`serializeState`/`deserializeState`（JSON）で往復でき、再接続復元・通信同期に使える
- **通信層（チケット10）**: サーバー権威。`RoomStore`（`src/lib/server/session.ts`）が部屋・席・`GameState` をメモリ保持（DB無し）。**席↔playerId 解決**は `SeatSlot.playerId`（席固定 `p0..p3`）で行い、`startGame` が席順に `initGame({players})` を組むので `state.players[i].seat===i` かつ `id===p{i}` が成立。**不正手の扱い**は `playCard/pass` の throw を `applyPlayerAction` が try/catch して `ILLEGAL_ACTION` に翻訳（麻雀の事前 `validate` の代替）。**CPU/切断者の自動進行**は `stepAuto`（rng不要・`decideWeak`）を `server.ts` の `driveAutoTimed` が遅延チェインで回す。CPU難易度の差し替え点は `stepAuto` 内の `decideWeak`（#12 で `strategyFor()` 化）
- **アダプタ契約**: `SevensAdapter`（`src/lib/adapter/types.ts`）。`PlayerAction = Action`（play/pass のみ）。`StartOptions` に `maxPass`/`startMode`/`cpuStrength` を持つ。`rematch`/`dissolve`/`onDissolved` は #17 で実装済み
- **部屋フローUI（チケット11）**: 画面遷移は `/`→`/host`or`/join`→`/room/[id]`。ロビーの開始（`gameState` 到着）で `useGotoRoomOnStart` が `/room/[id]` へ push。接続は `useGameConnection`/`ensureConnected` 経由で維持し、**アンマウントで切らない**（遷移で socket を落とさない）。QR/URL はホストの LAN アドレス（`/api/server-info`）＋`?code=合言葉`。`GameBoard` は `gameState` を購読するだけ（楽観適用なし・`send` で操作）。リロード/直アクセスは部屋情報を失う→「部屋が見つかりません」（本格再接続は#13）
- **CPU強さ**: `CpuStrength`（`weak`/`medium`/`strong`）を `StartOptions`→`RoomStore`（席ごと）→`stepAuto` の `strategyFor()` まで配線。思考は `cpu/{weak,medium,strong}.ts`＋共通 `heuristics.ts`（`centrality`/`opponentGain`/`threatHandSize`）。**中＝自分中心**（外側の札を出し7寄りゲートを温存・相手は覗かない・パスしない）、**強＝相手の実手札を読む**（得させる札を避け、上がり間近の相手のキーカードをパスで止める／脱落回避ガード付き）。乱数なし＋`cardId` タイブレークで決定論的、パス回数有限で必ず終局。CPUアバター素材・表示は#16/#17
- **手札の情報露出**: `game:state` は全席の手札を含むが、UIは自席手札＋相手の枚数（裏面）のみ表示。教室内クローズドLAN前提でアンチチートはしない割り切り
- **切断・再接続（チケット13）**: サーバーは席を保持し（`markDisconnected` で `connected=false`）、切断中は CPU 代行（`stepAuto`）。クライアントは入室時に `roomId/seat/token` を **sessionStorage** に保存（`session-storage.ts`）し、リロード時は `useGameConnection` が `restoreSession` で再水和→`onConnectionChange('connected')` が `room:reconnect` を発火→`broadcast` で権威状態を復元。再接続失敗（部屋消滅）はセッション破棄＋ids リセットで「部屋が見つかりません」へ。ホストPC落ち＝サーバー消失＝対局終了（致命的復元なし）。socket.io の既定リトライに依存（指数バックオフ等は足さない）
- **音声・効果音（チケット14）**: 専用 Socket イベントは増やさず、クライアントは `game:state` の**前後差分**で「何が起きたか」を導出する。純関数 `diffGameState(prev,next)`（`src/lib/audio/events.ts`）が play/pass/finish/eliminated/deal/end を返す（1遷移=1アクションなので素直。脱落の場放出を出札と誤検出しないよう脱落を先に判定／出した札は `board` 差分で特定／配札は「場=初期7のみ＋手札+場=52」で判定）。`prev===null`（セッション初回観測）はベースライン＝配札以外は無音にし、再接続時の一斉再生を防ぐ。`useAudioEffects` が `gameStore.subscribe` で購読しマウント時に現値も1度評価（ロビー開始→遷移で初回 state を取りこぼさないため）。**読み上げは Web Speech API**（`speech.ts`・録音不要・`cardSpeech` で「ダイヤの8！」等）、**効果音は mp3**（`sfx.ts`・固定名・`onerror`/play 拒否で無音フォールバック＝未配置でもエラーにしない）。音量/ミュートは `audioStore`＋`audio-settings-storage.ts`（sessionStorage・端末ごと・既定0.5）。自動再生ポリシーは `unlock.ts` が初回操作で解禁。全端末が全イベントで発音し、にぎやかさは端末ごとの音量で各自調整（ターン通知音は#15、結果演出は#17）
- **お助けモード（チケット15）**: 判定ロジックは既存純関数（`playableCards`/`hasPlayable`／`pass.ts` の `isWastefulPass`）を再利用し、本チケットは UI＋トグル状態の配線のみ。トグルは端末ごと（`helpStore`＋`help-settings-storage.ts`／sessionStorage `sevens:help`・既定ON）で、`audioStore` と同じく初期値ONで描画→マウント後 `hydrate()` で復元（SSR不整合回避）。`HandCards` は `helpMode` prop で挙動切替: **ON**＝出せる札ハイライト＋出せない札グレーアウト＋出せる札のみクリック可、**OFF**＝強調なし・手番中は全札クリック可（不正手は `GameBoard` の `canPlay` と「出す」ボタン非活性＋サーバー権威で弾く）。無駄パス警告は `helpMode && hasPlayable(...)` のとき `PassWarningDialog` を挟む（OFF や出せる札なしは即パス）。ターン通知/残パス強調は `TurnBanner`（ON＝点滅バナー＋残0警告色、OFF＝控えめ）。「待って」「出す前確認」「脱落警告」は#16、ターン通知音は付けない（音源追加回避）
- **PC横長レイアウト・シニアUI（チケット16）**: 場（`Board.tsx`）は **A〜K の13列固定**で**7を中央基準**にし、未配置ランクは空きスロット枠（7枠は強調）で「左右に伸びる」様子を可視化（脱落の飛び札＝隙間も空きスロットで自然表現）。横長最優先、狭幅は `overflow-x-auto`。相手（`OpponentArea.tsx`）はアバター＋名前＋残枚数＋残パス＋手番強調＋切断中/CPUバッジ。CPU/接続状態は `GameState.players`（`Player`）に無いので **`gameStore.players`（`PlayerInfo[]`）を席で引き当て**（`infoBySeat`）て渡す。**アバターは席番号で決まる装飾**（`avatarSrcForSeat`・名前は別表示・記録には使わない）。**「待って」はローカル演出のみ**（サーバーは接続中human の手番を `stepAuto` で自動進行しない＝無期限に待つため、機能的停止は不要。手番が移れば自動解除）。**「出す前確認」**は `uiSettingsStore`（sessionStorage `sevens:ui`・既定ON）で、`audioStore`/`helpStore` と同じく初期ON描画→`hydrate()`。確認モーダルは汎用 `ui/ConfirmDialog` に一本化し `PassWarningDialog` も委譲（重複排除）。設定トグルと退室は左上 `GameMenu` に集約（4.1 のメニュー＝左上／音量・お助け＝右上）
- **結果画面・もう一回・解散（チケット17）**: 結果表示は `ResultScreen.tsx`（`computeStandings`/`standingLabel`＋`Avatar`）。**もう一回・解散はホスト限定**（`game:start` と同じ seat0 限定／非ホストは待機＋自分の退出のみ）。`RoomStore` は `startGame` の配り直しを `dealInto` に抽出し、`rematch` は `started && phase==='ended'` のときだけ**同じ席編成（名前/CPU強さ）・同設定（maxPass/startMode）＋新seed**で再配札（設定変更しての再戦はスコープ外）。解散は `room:dissolved` を全員に配って `removeRoom`→各クライアントが `gameStore.dissolved` を見て `disconnect()+push('/')`。再戦の配り直し（ended→fresh deal）でも `diffGameState` がシャッフル音を鳴らす。検証は `session.test.ts`（rematch）/`sync.test.ts`（rematch/dissolve 結合）/`events.test.ts`（再戦deal）。**フェーズ1〜4 完了**

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

- トランプカードは**SVGで自作**し `public/cards/` に配置済み（命名: `s1〜s13`=スペードA〜K, `h*`=ハート, `d*`=ダイヤ, `c*`=クラブ, `back.svg`=裏面）。`cardId`（`cards.ts`、例 `d7`）とファイル名が一致。生成は `scripts/generate-cards.mjs`（`npm run cards:generate`）— 手書きせずスクリプトを編集して再生成する
- 音声・効果音は `public/audio/`（未着手）、mp3を事前ロード。読み上げ（「ダイヤの8！」等）・拍手音・シャッフル音など「ワイワイ感」が中心機能
