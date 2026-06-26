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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentPlayer, type GameState } from "@/lib/sevens/state";
import { isPlayable, hasPlayable } from "@/lib/sevens/playable";
import { computeStandings, standingLabel } from "@/lib/sevens/ranking";
import { cardId, type Card } from "@/lib/sevens/cards";
import type { PlayerInfo } from "@/lib/adapter/types";
import { useGameConnection } from "@/lib/store/useGameConnection";
import { useGameStore } from "@/lib/store/gameStore";
import { useHelpStore } from "@/lib/store/helpStore";
import { useUiSettingsStore } from "@/lib/store/uiSettingsStore";
import { useAudioEffects } from "@/lib/audio/useAudioEffects";
import { AudioControls } from "@/components/audio";
import { HelpToggle, PassWarningDialog, TurnBanner } from "@/components/help";
import { Button, ConfirmDialog, Heading, ScreenContainer } from "@/components/ui";
import Board from "./Board";
import CardView from "./Card";
import HandCards from "./HandCards";
import ActionButtons from "./ActionButtons";
import OpponentArea from "./OpponentArea";
import Avatar from "./Avatar";
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

export function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  useGameConnection(); // 接続維持（タイトル→対局のクライアント遷移で切らない）
  useAudioEffects(); // ゲームイベントを効果音・読み上げにひも付け（#14）
  const gameState = useGameStore((s) => s.gameState);
  const mySeat = useGameStore((s) => s.mySeat);
  const connection = useGameStore((s) => s.connection);
  const players = useGameStore((s) => s.players); // PlayerInfo[]（CPU/接続状態）
  const send = useGameStore((s) => s.send);
  const helpMode = useHelpStore((s) => s.helpMode);
  const confirmBeforePlay = useUiSettingsStore((s) => s.confirmBeforePlay);
  const [selected, setSelected] = useState<Card | null>(null);
  const [passWarnOpen, setPassWarnOpen] = useState(false);
  const [playConfirmOpen, setPlayConfirmOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  // 席 → PlayerInfo の引き当て（OpponentArea へ接続/CPU 情報を渡す）。
  const infoBySeat = useMemo(() => {
    const map = new Map<number, PlayerInfo>(players.map((p) => [p.seat, p]));
    return (seat: number) => map.get(seat);
  }, [players]);

  const isMyTurn = gameState?.phase === "playing" && gameState.currentSeat === mySeat;
  // 自分の手番でなくなったら「待って」を自動解除。
  useEffect(() => {
    if (!isMyTurn && paused) setPaused(false);
  }, [isMyTurn, paused]);

  const backToTitle = () => {
    useGameStore.getState().disconnect();
    router.push("/");
  };

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

  const doPlay = () => {
    if (!selected) return;
    send({ type: "play", card: selected });
    setSelected(null);
    setPlayConfirmOpen(false);
  };

  const handlePlay = () => {
    if (!canPlay || !selected) return;
    // 「出す前確認」ON のときは送信前に確認（誤操作リカバリ・#16・REQUIREMENTS 3.7）。
    if (confirmBeforePlay) {
      setPlayConfirmOpen(true);
      return;
    }
    doPlay();
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

  return (
    <ScreenContainer showRotateHint className="bg-green-800 text-white">
      <div data-room-id={roomId} className="mx-auto flex max-w-6xl flex-col gap-4">
        {connection !== "connected" && (
          <p
            role="status"
            className="rounded-xl bg-amber-500 px-4 py-2 text-center text-base font-bold text-black"
          >
            通信が切れました。再接続しています…
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GameMenu onBackToTitle={backToTitle} />
            <h1 className="text-2xl font-bold">7並べ</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <HelpToggle />
            <AudioControls />
          </div>
        </div>

        <OpponentArea
          players={opponents}
          currentSeat={gameState.currentSeat}
          infoBySeat={infoBySeat}
        />

        <Board board={gameState.board} />

        {ended ? (
          <Results state={gameState} mySeat={mySeat} onBack={backToTitle} />
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
                  onSelect={setSelected}
                  disabled={!isMyTurn || human.status !== "playing"}
                  helpMode={helpMode}
                />

                {isMyTurn && human.status === "playing" && (
                  <ActionButtons
                    canPlay={canPlay}
                    onPlay={handlePlay}
                    onPass={handlePass}
                    onWait={() => setPaused(true)}
                    passesLeft={human.passesLeft}
                    mySeat={mySeat}
                    myName={human.name}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <PassWarningDialog
        open={passWarnOpen}
        onConfirm={doPass}
        onCancel={() => setPassWarnOpen(false)}
      />

      <ConfirmDialog
        open={playConfirmOpen}
        title="このカードを出しますか？"
        confirmLabel="出す"
        cancelLabel="やめる"
        confirmVariant="primary"
        onConfirm={doPlay}
        onCancel={() => setPlayConfirmOpen(false)}
      >
        {selected && <CardView card={selected} size="lg" />}
      </ConfirmDialog>
    </ScreenContainer>
  );
}

function Results({
  state,
  mySeat,
  onBack,
}: {
  state: GameState;
  mySeat: number;
  onBack: () => void;
}) {
  const standings = computeStandings(state);
  return (
    <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/60 p-6">
      <h2 className="text-2xl font-bold">対局終了</h2>
      <ol className="flex flex-col gap-2">
        {standings.map((s) => (
          <li key={s.player.id} className="text-xl">
            <span
              className={`font-bold ${
                s.outcome === "eliminated" ? "text-rose-300" : "text-yellow-300"
              }`}
            >
              {standingLabel(s)}
            </span>{" "}
            {s.player.name}
            {s.player.seat === mySeat && "（あなた）"}
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" onClick={onBack}>
        トップへ戻る
      </Button>
    </div>
  );
}
