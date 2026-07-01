// 共有プラットフォームの中核契約（REQUIREMENTS_platform.md §1.1 / §7.3）。
// 「共有プラットフォーム＋ゲームモジュール」方式の継ぎ目。土台（部屋・席・通信・CPU枠）は
// ゲームの中身を知らず、各ゲームはこの GameModule を実装して差し込む。
//
// State/Action/View/Config はすべてジェネリック＝土台は不透明に扱う。7並べは State===View の
// 恒等 getView（全公開）。神経衰弱は getView で中身を隠す（フェーズ3・§2.2）。
// 型はすべて JSONシリアライズ可能なプレーンデータであること（通信・再接続で往復する）。

/** 席番号 0..n-1。ゲーム状態の players[i].seat と一致する。 */
export type Seat = number;

/** CPU基盤の弱・中・強の枠（§4）。思考の中身はゲームごとに別実装。 */
export type CpuStrength = "weak" | "medium" | "strong";

/** 配席時にモジュールへ渡す最小のプレイヤー情報（名前は表示・記録には使わない）。 */
export interface PlayerRef {
  readonly id: string;
  readonly name: string;
}

/** 状態遷移で新たに起きた出来事（音声・演出フック用・§7）。 */
export type GameTransition =
  | { readonly type: "finish"; readonly seat: Seat; readonly rank?: number }
  | { readonly type: "eliminated"; readonly seat: Seat; readonly order?: number };

/**
 * 差し込み式ゲームモジュールの契約。RoomStore（土台）がこれ越しにゲームを進行する。
 * - State  : ゲーム状態（サーバー権威・プレーンデータ）
 * - Action : プレイヤーの行動（7並べ = play/pass）
 * - View   : プレイヤーごとの可視状態（7並べ = State と同一）
 * - Config : 開始オプション（7並べ = maxPass/startMode/wrapAround）
 */
export interface GameModule<State, Action, View, Config> {
  readonly id: string; // 'sevens' | 'concentration'
  readonly name: string; // 表示名（ゲーム選択UI用）
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly cpuFill: boolean; // 人数不足時にCPUで補完するか

  /**
   * true = 状態は全公開。土台は部屋一括で1つの view を配信できる（7並べ）。
   * false = 席ごとに中身が異なる。土台は席ごとに getView して個別配信する（神経衰弱・フェーズ3）。
   */
  readonly viewIsPublic: boolean;

  /** 初期状態を作る。seed で決定論的に（テスト・再現）。 */
  createInitialState(players: readonly PlayerRef[], config: Config, seed: number): State;

  /** 行動を適用した新状態を返す。不正手は throw（既存7並べの playCard/pass 踏襲）。 */
  handleAction(state: State, playerId: string, action: Action): State;

  /** 指定席から見える可視状態。7並べは恒等 (s)=>s。神経衰弱はここで中身を隠す。 */
  getView(state: State, seat: Seat): View;

  /** 終局したか。 */
  isFinished(state: State): boolean;

  /** 手番の席。終局・該当なしは null。土台が「自動席（CPU/切断代行）か」を判定するのに使う。 */
  currentSeat(state: State): Seat | null;

  /** CPU・切断代行の「次の一手」を決める（適用は handleAction）。 */
  decideAuto(state: State, playerId: string, strength: CpuStrength): Action;

  /**
   * 手番の人間が接続中でも、サーバーが自動で次を進めるべき状態か。
   * 例: 神経衰弱で2枚めくった後の「見せてから伏せる」＝数秒後にサーバーが resolve を確定する。
   * true のとき土台は currentSeat の playerId に対し decideAuto を自動適用する。7並べは常に false。
   */
  autoResolvable(state: State): boolean;

  /** before→after で新たに起きた出来事（finish/eliminated 等）を列挙する（演出用）。 */
  transitions(before: State, after: State): readonly GameTransition[];
}
