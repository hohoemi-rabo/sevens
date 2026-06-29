"use client";

/**
 * 対局画面のオーケストレータ（ネットワーク版）。
 *
 * サーバー権威: UI は gameState を一切ミューテートせず、操作は store.send で送り
 * 次の game:state を待つ（楽観適用しない）。CPU/切断者の自動進行はサーバーが担う。
 * レイアウトは PC横長最優先（#16・REQUIREMENTS 4.1）: 上=メニュー/相手3人、中央=場、
 * 下=手札＋操作バー。プレゼン部品（Board/HandCards/ActionButtons/OpponentArea/Avatar）を組む。
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentPlayer } from "@/lib/sevens/state";
import { isPlayable, hasPlayable } from "@/lib/sevens/playable";
import { cardId, type Card } from "@/lib/sevens/cards";
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

/**
 * 出す演出：手元のカードを置き場まで飛ばすゴーストカード（最前面・操作不可）。
 * 採寸済みの from/to 矩形の間を transform で動かす（手札 lg → 盤面 bd へ縮小）。
 * 着地（transitionend）またはフォールバックタイマで onDone を呼ぶ。
 */
function FlyingCard({
  card,
  from,
  to,
  onDone,
}: {
  card: Card;
  from: DOMRect;
  to: DOMRect;
  onDone: () => void;
}) {
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMoved(true));
    // transitionend を取りこぼしても必ず後始末する保険（トランジション長＋余裕）。
    const timer = setTimeout(onDone, 760);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onDone]);

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
        transition: "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
        zIndex: 60,
        pointerEvents: "none",
        willChange: "transform",
      }}
      className="rounded-lg bg-white shadow-2xl"
    />,
    document.body,
  );
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
  // 出す演出（手元→置き場の飛行）。flying=ゴースト、hideCardId=着地まで盤面で隠す札。
  const [flying, setFlying] = useState<{ card: Card; from: DOMRect; to: DOMRect } | null>(null);
  const [hideCardId, setHideCardId] = useState<string | null>(null);

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
      setFlying(null);
      setHideCardId(null);
    }
  }, [phase]);

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
      setFlying({
        card,
        from: fromEl.getBoundingClientRect(),
        to: toEl.getBoundingClientRect(),
      });
      setHideCardId(id); // 着地まで盤面の本物は隠す（二重表示防止）。
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

        <Board board={gameState.board} hideCardId={hideCardId} />

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

      {flying && (
        <FlyingCard
          card={flying.card}
          from={flying.from}
          to={flying.to}
          onDone={() => {
            setFlying(null);
            setHideCardId(null);
          }}
        />
      )}
    </ScreenContainer>
  );
}
