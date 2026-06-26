# 11. 部屋作成・合言葉入室・QR・席割り

**フェーズ**: 3　**依存**: 10　**対象**: `src/app/`（page/host/join/room）, `src/components/`

## 概要
ホストが部屋を作り、参加者がQR/URL＋4桁合言葉で入室し、席を決めて対局を開始するまでの一連のフローを実装する。

## 関連要件
- `REQUIREMENTS.md` 2.2（接続方法）、3.1、3.6（対局フロー 1〜5）、7.2（画面構成）

## 仕様メモ
- 画面（`REQUIREMENTS.md` 7.2）：`app/page.tsx`（トップ）/ `app/host/page.tsx`（合言葉・QR・設定）/ `app/join/page.tsx`（入室）/ `app/room/[id]/page.tsx`（対局）
- ホスト起動時に QRコードと URL（例 `http://192.168.x.x:3000`）を表示
- 4桁合言葉で入室制限（`REQUIREMENTS.md` 5.4）。認証は無し（教室内クローズド前提）
- 部屋作成時にホストが **パス回数（1〜5）** と **CPU強さ（弱/中/強）** を設定（07・12と連携）
- 4人席の自動割当 or 手動選択。人数不足はCPUで埋める（12）
- QRコード生成ライブラリを1つ追加する想定（依存追加時は `CLAUDE.md` 方針に従い妥当性を確認）
- **Next 15**：`app/room/[id]/page.tsx` の `params` は Promise。`await params` で取得する

## Todo
- [x] トップ画面（部屋を作る / 参加する ＋ ひとりで遊ぶ）
- [x] ホスト画面：合言葉生成・QRコード/URL表示（`/api/server-info` の LAN URL＋`?code=`）
- [x] ホスト設定UI：パス回数（1〜5）・CPU強さ（弱/中/強）※CPU強さは配線まで（中/強の挙動は#12）
- [x] 入室画面：合言葉入力・名前入力
- [x] 席選択（自動割当）※手動選択UIは未実装（自動割当で十分なため見送り）
- [x] 「CPUで埋める」（`start({fillWithCpu:true})` で開始時に空席を補完。ロビーが空席を明示）
- [x] 対局画面へ遷移し `game:start` で開始（`useGotoRoomOnStart`）
- [x] `room/[id]` の `params` を `await` で取得（Next 15対応）。`join` の `searchParams` も `await`

## 完了条件
- [x] 別端末からQR/合言葉で入室し、席に着いて対局を開始できる
  - 実サーバー（server.ts）に対する socket E2E で create→join→start→双方同期→CPU自動進行→終局を確認。`npm run build` で全ルート（`/`・`/host`・`/join`・`/room/[id]`・`/api/server-info`）が通る
- [x] ホスト設定（パス回数・CPU強さ）がゲームに反映される
  - パス回数は `maxPass` がそのまま反映。CPU強さは選択→`StartOptions`→`RoomStore` まで伝達（挙動の差は#12）

## スコープ補足
- **手動席選択**は実装せず自動割当のみ（教室運用では席番号の意味が薄く、要件3.1も「自動割当 or 手動」）。必要になれば後追い。
- **もう一回/部屋を解散**（要件3.6-10）はチケット17。**切断/再接続**はチケット13。
