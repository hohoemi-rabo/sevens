# 13. 切断・再接続

**フェーズ**: 3　**依存**: 10　**対象**: `server.ts`, `src/lib/adapter/`, `src/lib/store/`

## 概要
参加端末が一時的に切断しても、再接続して対局状態を復元できるようにする。

## 関連要件
- `REQUIREMENTS.md` 5.2（信頼性）

## 仕様メモ
- 参加端末が切断した場合、**5秒以内に再接続可能**にする
- 再接続後、サーバーが保持する権威状態（10）から**対局状態を復元**
- ホストPCが落ちた場合は対局終了（1ゲーム制なので影響軽微）→ 致命的復元は不要
- プレイヤーの再識別子（席 or トークン）を用意し、再接続時に同じ席へ戻す
- `CLAUDE.md` の信頼性方針（タイムアウト・リトライ）を意識。指数バックオフ等は過剰にしない（LAN内・1ゲーム制）

## Todo
- [x] プレイヤー再識別の仕組み（席ID/トークン）を用意（`SeatSlot.token`・`SeatAssignment.token`・チケット10）
- [x] 切断検知（Socket.io disconnect）と猶予保持（`markDisconnected` で席は保持・`connected=false`、切断中は CPU 代行・チケット10）
- [x] 再接続フローと状態復元（`room:reconnect`→`reconnect`→`broadcast` で権威状態を再送・チケット10）
- [x] 再接続時に同じ席・手札に戻ることを確認（in-process 結合テスト `sync.test.ts`）
- [x] ホスト切断時の対局終了ハンドリング（下記方針）
- [x] **（本チケットの主眼）リロード/再読込からの復元**：`roomId/seat/token` を sessionStorage に永続化し、マウント時に再水和して自動再接続。切断中はバナー表示

## 完了条件
- [x] 参加端末を切断→再接続して対局を継続できる
  - 一時的なネットワーク断は socket.io 自動リトライ＋`onConnectionChange('connected')` の `reconnect` で復帰（チケット10）。**リロード/再読込**は sessionStorage 永続化＋`restoreSession`＋`useGameConnection` の再水和で復帰（本チケット）
- [x] 復元後の手札・場・手番が切断前と一致する
  - `sync.test.ts`：A 切断→トークン再接続で受信状態がサーバー権威状態（=B が見る状態）と一致、同じ席(0)に復帰を検証

## 設計メモ（確定）
- **永続化は sessionStorage**（`src/lib/store/session-storage.ts`・`{roomId,seat,token}`）。タブ単位・リロード生存・タブを閉じると破棄＝1ゲーム制・教室運用に最適、複数タブで席を奪い合わない。
- **再接続失敗時**（部屋消滅・サーバー再起動）はセッションを破棄し ids をリセット→`GameBoard` が「部屋が見つかりません」に落ちる（無限「準備中…」を防ぐ）。
- **ホスト切断**：ホストPCが落ちる＝サーバー自体が消えるので復元不可・対局終了（致命的復元は不要・仕様どおり）。ホストが「参加者として」切断した場合は席0が CPU 代行で対局継続（既存 `stepAuto`）。新規のホスト専用ロジックは無し。
- socket.io-client の既定リトライ（`reconnection:true`・1〜5s バックオフ）に任せる（指数バックオフ等は追加しない・LAN内）。
- サーバー（`server.ts`/`RoomStore`）は無改修。本チケットの変更はクライアント（store/hook/UI）とテストのみ。
