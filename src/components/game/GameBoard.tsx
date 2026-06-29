"use client";

/**
 * 対局画面のオーケストレータ（ネットワーク版）。
 *
 * サーバー権威: UI は gameState を一切ミューテートせず、操作は store.send で送り
 * 次の game:state を待つ（楽観適用しない）。CPU/切断者の自動進行はサーバーが担う。
 * レイアウトは PC横長最優先（#16・REQUIREMENTS 4.1）: 上=メニュー/相手3人、中央=場、
 * 下=手札＋操作バー。プレゼン部品（Board/HandCards/ActionButtons/OpponentArea/Avatar）を組む。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentPlayer, type GameState } from "@/lib/sevens/state";
import { diffGameState } from "@/lib/audio/events";
import { isPlayable, hasPlayable } from "@/lib/sevens/playable";
import { SUITS, cardId, type Card, type Rank } from "@/lib/sevens/cards";
import type { PlayerInfo } from "@/lib/adapter/types";
import { useGameConnection } from "@/lib/store/useGameConnection";
import { useGameStore } from "@/lib/store/gameStore";
import { useHelpStore } from "@/lib/store/helpStore";
import { useAudioEffects } from "@/lib/audio/useAudioEffects";
import { useBgm } from "@/lib/audio/useBgm";
import { PassWarningDialog, TurnBanner } from "@/components/help";
import { Button, ConfirmDialog, Heading, ScreenContainer } from "@/components/ui";
import Board from "./Board";
import CardView from "./Card";
import HandCards from "./HandCards";
import ActionButtons from "./ActionButtons";
import OpponentArea from "./OpponentArea";
import Avatar from "./Avatar";
import ResultScreen from "./ResultScreen";
import { GameMenu } from "./GameMenu";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ScreenContainer className="bg-green-800 text-white">
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        {children}
      </div>
    </ScreenContainer>
  );
}

/** 飛行アニメの採寸矩形（getBoundingClientRect の DOMRect も構造的に代入可）。 */
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// 描画前に本物カードを隠して「ちらつき」を防ぐため layout effect を使う。
// SSR では実行されない（警告回避のため window 有無で出し分け）。
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const FLY_MS = 520;

/**
 * 出す/配る演出：カードを目的スロットまで飛ばすゴーストカード（最前面・操作不可）。
 * 採寸済みの from/to 矩形の間を transform で動かす（自分=手札 lg→盤面 bd へ縮小、
 * 相手=相手エリアから盤面サイズで並進、配札=7を上からドロップ）。
 * delay でずらして配札を順に落とす。着地（transitionend）またはフォールバックタイマで onDone。
 */
function FlyingCard({
  card,
  from,
  to,
  delay = 0,
  onDone,
}: {
  card: Card;
  from: Rect;
  to: Rect;
  delay?: number;
  onDone: () => void;
}) {
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoved(true));
    // transitionend を取りこぼしても必ず後始末する保険（待機+トランジション長＋余裕）。
    const timer = setTimeout(onDone, delay + FLY_MS + 240);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onDone, delay]);

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const scale = to.width / from.width;

  return createPortal(
    // eslint-disable-next-line @next/next/no-img-element -- SVGは最適化不要
    <img
      src={`/cards/${cardId(card)}.svg`}
      alt=""
      aria-hidden
      onTransitionEnd={onDone}
      style={{
        position: "fixed",
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        transform: moved
          ? `translate(${dx}px, ${dy}px) scale(${scale})`
          : "translate(0, 0) scale(1)",
        transformOrigin: "top left",
        transition: `transform ${FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        zIndex: 60,
        pointerEvents: "none",
        willChange: "transform",
      }}
      className="rounded-lg bg-white shadow-2xl"
    />,
    document.body,
  );
}

/** 飛行中の1枚（cardId をキーに複数同時管理＝配札の7など）。 */
interface Flyer {
  id: string;
  card: Card;
  from: Rect;
  to: Rect;
  delay?: number;
}

export function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  useGameConnection(); // 接続維持（タイトル→対局のクライアント遷移で切らない）
  useAudioEffects(); // ゲームイベントを効果音・読み上げにひも付け（#14）
  useBgm(); // BGM（対局中のみ・既定OFF・端末ごとにメニューでON）
  const gameState = useGameStore((s) => s.gameState);
  const mySeat = useGameStore((s) => s.mySeat);
  const connection = useGameStore((s) => s.connection);
  const players = useGameStore((s) => s.players); // PlayerInfo[]（CPU/接続状態）
  const dissolved = useGameStore((s) => s.dissolved);
  const send = useGameStore((s) => s.send);
  const helpMode = useHelpStore((s) => s.helpMode);
  const hydrateHelp = useHelpStore((s) => s.hydrate);
  const [selected, setSelected] = useState<Card | null>(null);
  const [passWarnOpen, setPassWarnOpen] = useState(false);
  const [playConfirmOpen, setPlayConfirmOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  // 飛行アニメ（出す/配る）。複数同時可（配札の7など）。着地まで該当札を盤面で隠す。
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const hiddenIds = useMemo(() => new Set(flyers.map((f) => f.id)), [flyers]);
  const addFlyers = (items: Flyer[]) =>
    setFlyers((prev) => [...prev, ...items.filter((it) => !prev.some((p) => p.id === it.id))]);
  const removeFlyer = (id: string) => setFlyers((prev) => prev.filter((f) => f.id !== id));
  // 相手の出札・配札アニメ用に直前の状態を保持して差分検出する（音とは別系統）。
  const animPrevRef = useRef<GameState | null>(null);

  // 席 → PlayerInfo の引き当て（OpponentArea へ接続/CPU 情報を渡す）。
  const infoBySeat = useMemo(() => {
    const map = new Map<number, PlayerInfo>(players.map((p) => [p.seat, p]));
    return (seat: number) => map.get(seat);
  }, [players]);

  // お助けモードの保存値を復元（トグルUIはメニュー内＝常時マウントではないため、
  // 常時マウントの本コンポーネントで hydrate しておく）。
  useEffect(() => {
    hydrateHelp();
  }, [hydrateHelp]);

  const isMyTurn = gameState?.phase === "playing" && gameState.currentSeat === mySeat;
  // 自分の手番でなくなったら「待って」を自動解除。
  useEffect(() => {
    if (!isMyTurn && paused) setPaused(false);
  }, [isMyTurn, paused]);

  const backToTitle = () => {
    useGameStore.getState().disconnect();
    router.push("/");
  };

  // ホストが解散したら全員トップへ戻す（#17・onDissolved → dissolved）。
  useEffect(() => {
    if (dissolved) backToTitle();
    // backToTitle は毎レンダー再生成だが dissolved の立ち上がりでのみ実行したい。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dissolved]);

  // 再戦（#17）で盤面に戻ったら選択・一時停止をリセット（終局時の選択を持ち越さない）。
  const phase = gameState?.phase;
  useEffect(() => {
    if (phase === "playing") {
      setSelected(null);
      setPaused(false);
    }
  }, [phase]);

  // 配札（開始時の7並び）と相手の出札を飛行アニメで見せる（自分の出札は doPlay で対応済み）。
  // 着地まで本物を隠すため、描画前に動く layout effect で採寸→flyers 追加し、
  // ちらつき（一瞬カードが見える）を防ぐ。CPU 着手間隔(0.8〜1.8s) > アニメ(520ms)。
  useIsoLayoutEffect(() => {
    const prev = animPrevRef.current;
    const next = gameState;
    animPrevRef.current = next;
    if (!next || prev === next) return;
    const rectOf = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    for (const ev of diffGameState(prev, next)) {
      if (ev.kind === "deal") {
        // 開始時：場の7たちを少しずつ上からドロップして並べる。
        const drops: Flyer[] = [];
        let i = 0;
        for (const suit of SUITS) {
          if (!next.board[suit].includes(7 as Rank)) continue;
          const card: Card = { suit, rank: 7 as Rank };
          const id = cardId(card);
          const dst = document.querySelector(`[data-card-id="${id}"]`);
          if (!dst) continue;
          const to = rectOf(dst);
          drops.push({
            id,
            card,
            from: { left: to.left, top: to.top - 160, width: to.width, height: to.height },
            to,
            delay: i * 110,
          });
          i++;
        }
        if (drops.length) addFlyers(drops);
        break;
      }
      if (ev.kind === "play" && mySeat !== null && ev.seat !== mySeat) {
        const id = cardId(ev.card);
        const srcEl = document.querySelector(`[data-opponent-seat="${ev.seat}"]`);
        const dstEl = document.querySelector(`[data-card-id="${id}"]`);
        if (!srcEl || !dstEl) break;
        const s = rectOf(srcEl);
        const to = rectOf(dstEl);
        // 相手は盤面サイズのまま、相手エリア中央 → スロットへ並進させる。
        addFlyers([
          {
            id,
            card: ev.card,
            from: {
              left: s.left + s.width / 2 - to.width / 2,
              top: s.top + s.height / 2 - to.height / 2,
              width: to.width,
              height: to.height,
            },
            to,
          },
        ]);
        break; // 1遷移=1出札
      }
    }
  }, [gameState, mySeat]);

  // 直接アクセス（保存セッションも無い）／再接続失敗で部屋情報が無い。
  if (!gameState && mySeat === null) {
    return (
      <Centered>
        <Heading level={2} className="!text-white">
          部屋が見つかりません
        </Heading>
        <p className="text-base text-white/80">トップからやり直してください。</p>
        <Link href="/">
          <Button variant="primary" size="lg">
            トップへ戻る
          </Button>
        </Link>
      </Centered>
    );
  }

  if (!gameState || mySeat === null) {
    return (
      <Centered>
        <Heading level={2} className="!text-white">
          準備中…
        </Heading>
        <p className="text-base text-white/80">配札を待っています。</p>
      </Centered>
    );
  }

  const human = gameState.players.find((p) => p.seat === mySeat)!;
  const opponents = gameState.players.filter((p) => p.seat !== mySeat);
  const ended = gameState.phase === "ended";
  const current = ended ? null : currentPlayer(gameState);
  const canPlay = isMyTurn && !!selected && isPlayable(selected, gameState.board);
  const isHost = infoBySeat(mySeat)?.isHost ?? mySeat === 0; // ホスト席は 0（hostSeat）

  // 手札タップ＝即・中央ポップアップ（生徒さんプレイのFB対応）。
  // ノートPCで「出す」ボタンが折り返しの下に隠れスクロールが要る問題を解消するため、
  // 選択した瞬間に画面中央のモーダルで確認する（出せない札もプレビューし理由を示す）。
  const handleSelect = (card: Card) => {
    setSelected(card);
    setPlayConfirmOpen(true);
  };

  const closePlayConfirm = () => {
    setPlayConfirmOpen(false);
    setSelected(null);
  };

  const doPlay = () => {
    if (!selected || !isPlayable(selected, gameState.board)) return;
    const card = selected;
    const id = cardId(card);
    // 出す前に手札カードと置き場スロットの位置を採寸し、その間を飛ばす（採れなければ演出なし）。
    const fromEl = document.querySelector(`[data-card-id="${id}"]`);
    const toEl = document.querySelector(`[data-board-slot="${id}"]`);
    if (fromEl && toEl) {
      const f = fromEl.getBoundingClientRect();
      const t = toEl.getBoundingClientRect();
      // 着地まで盤面の本物は隠す（hiddenIds に id が入る＝二重表示防止）。
      addFlyers([
        {
          id,
          card,
          from: { left: f.left, top: f.top, width: f.width, height: f.height },
          to: { left: t.left, top: t.top, width: t.width, height: t.height },
        },
      ]);
    }
    send({ type: "play", card });
    setSelected(null);
    setPlayConfirmOpen(false);
  };

  const doPass = () => {
    send({ type: "pass" });
    setSelected(null);
    setPassWarnOpen(false);
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    // お助けON で出せる札があるのにパスしようとしたら確認（#15・REQUIREMENTS 3.3）。
    if (helpMode && hasPlayable(human.hand, gameState.board)) {
      setPassWarnOpen(true);
      return;
    }
    doPass();
  };

  const showActionBar = isMyTurn && human.status === "playing" && !paused && !ended;

  return (
    <ScreenContainer showRotateHint wide className="bg-green-800 text-white">
      {/* メニュー（お助け・音・退室を内包）は左上に小さく浮かせ、ヘッダー帯を無くす。
          空いた縦ぶんメンバー・場を上に詰め、場（盤面）を大きく見せる（生徒さんプレイのFB対応）。 */}
      <div className="fixed left-3 top-3 z-40 flex items-center gap-2">
        <GameMenu onBackToTitle={backToTitle} />
        <span className="hidden rounded-lg bg-green-900/70 px-2 py-1 text-base font-bold text-white sm:inline">
          7並べ
        </span>
      </div>

      <div
        data-room-id={roomId}
        className={`mx-auto flex max-w-6xl flex-col gap-3 ${showActionBar ? "pb-28" : ""}`}
      >
        {connection !== "connected" && (
          <p
            role="status"
            className="rounded-xl bg-amber-500 px-4 py-2 text-center text-base font-bold text-black"
          >
            通信が切れました。再接続しています…
          </p>
        )}

        <OpponentArea
          players={opponents}
          currentSeat={gameState.currentSeat}
          infoBySeat={infoBySeat}
        />

        <Board board={gameState.board} hiddenIds={hiddenIds} />

        {ended ? (
          <ResultScreen
            state={gameState}
            mySeat={mySeat}
            isHost={isHost}
            onRematch={() => useGameStore.getState().rematch()}
            onDissolve={() => useGameStore.getState().dissolve()}
            onLeave={backToTitle}
          />
        ) : (
          <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/40 p-4">
            {paused && isMyTurn ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <Avatar seat={mySeat} name={human.name} size="lg" />
                <p className="text-2xl font-bold text-yellow-200">ひと休み中…</p>
                <p className="text-base text-white/80">
                  あなたの番です。ゆっくり考えて、準備ができたら再開してください。
                </p>
                <Button variant="primary" size="lg" onClick={() => setPaused(false)}>
                  ▶ 再開する
                </Button>
              </div>
            ) : (
              <>
                <TurnBanner
                  isMyTurn={isMyTurn}
                  helpMode={helpMode}
                  currentName={current?.name}
                  passesLeft={human.passesLeft}
                />

                <HandCards
                  hand={human.hand}
                  board={gameState.board}
                  selectedId={selected ? cardId(selected) : null}
                  onSelect={handleSelect}
                  disabled={!isMyTurn || human.status !== "playing"}
                  helpMode={helpMode}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* 操作バーは画面下に固定（fixed）。スクロール無しに必ず押せる。 */}
      {showActionBar && (
        <ActionButtons
          onPass={handlePass}
          onWait={() => setPaused(true)}
          passesLeft={human.passesLeft}
          mySeat={mySeat}
          myName={human.name}
        />
      )}

      <PassWarningDialog
        open={passWarnOpen}
        onConfirm={doPass}
        onCancel={() => setPassWarnOpen(false)}
      />

      <ConfirmDialog
        open={playConfirmOpen}
        title={canPlay ? "このカードを出しますか？" : "今は出せません"}
        message={
          canPlay ? undefined : "このカードは今は出せません。ほかの札を選ぶか、パスしてください。"
        }
        confirmLabel="出す"
        cancelLabel={canPlay ? "やめる" : "とじる"}
        confirmVariant="primary"
        confirmDisabled={!canPlay}
        onConfirm={doPlay}
        onCancel={closePlayConfirm}
      >
        {selected && <CardView card={selected} size="lg" />}
      </ConfirmDialog>

      {flyers.map((f) => (
        <FlyingCard
          key={f.id}
          card={f.card}
          from={f.from}
          to={f.to}
          delay={f.delay}
          onDone={() => removeFlyer(f.id)}
        />
      ))}
    </ScreenContainer>
  );
}
