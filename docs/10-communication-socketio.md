# 10. 通信層（Socket.io / LocalAdapter / server.ts）

**フェーズ**: 3　**依存**: 03　**対象**: `server.ts`, `src/lib/adapter/`, `src/lib/store/`

## 概要
Next.jsとSocket.ioを同居させるカスタムサーバーを構築し、ゲーム状態を同一LAN内の複数端末で同期する通信層を実装する。麻雀ゲームの `LocalAdapter` を流用する。

## 関連要件
- `REQUIREMENTS.md` 6.2、7.1（通信層）、7.3（通信プロトコル）

## 仕様メモ
- **通信層はゲームロジックに依存してよいが、ゲームロジックは通信層に依存しない**（`CLAUDE.md` の3層分離を厳守）
- アダプタは差し替え可能な抽象に：`LocalAdapter`（Socket.io 同一LAN）／将来 `RemoteAdapter`
- サーバー側がゲーム状態の権威（authoritative）。クライアントは操作を送り、`game:state` を受けて描画
- Socket.ioイベント（`REQUIREMENTS.md` 7.3）：`room:create`/`room:created`, `room:join`/`room:joined`, `room:players`, `game:start`, `game:state`, `player:play`, `player:pass`, `player:finish`, `player:eliminated`, `game:end`
- クライアント状態は Zustand store（`src/lib/store/`）で保持

## Todo
- [ ] `server.ts`：Next.js + Socket.io 同居のカスタムサーバーを構築
- [ ] 開発起動方法を整理し `package.json` / `CLAUDE.md` のコマンドを更新（custom server 起動）
- [ ] アダプタの抽象インターフェースを定義
- [ ] `LocalAdapter`（Socket.io）を実装
- [ ] サーバー側で 03 の状態を権威として保持し、操作イベントで更新
- [ ] `game:state` のブロードキャストと、クライアント Zustand への反映
- [ ] 主要イベント（play/pass/finish/eliminated/end）の疎通確認

## 完了条件
- 複数ブラウザ（同一LAN想定）で状態が同期し、操作が反映される
- ゲームロジック層が通信層をimportしていない
