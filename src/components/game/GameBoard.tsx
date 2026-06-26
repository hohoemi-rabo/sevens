"use client";

/**
 * 対局画面のオーケストレータ（ネットワーク版）。
 *
 * サーバー権威: UI は gameState を一切ミューテートせず、操作は store.send で送り
 * 次の game:state を待つ（楽観適用しない）。CPU/切断者の自動進行はサーバーが担う。
 * 旧 GameTable（ローカルCPU駆動）を置き換える。プレゼン部品（Board/HandCards/
 * ActionButtons/OpponentArea）はそのまま再利用する。
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentPlayer, type GameState } from "@/lib/sevens/state";
import { isPlayable, hasPlayable } from "@/lib/sevens/playable";
import { computeStandings, standingLabel } from "@/lib/sevens/ranking";
import { cardId, type Card } from "@/lib/sevens/cards";
import { useGameConnection } from "@/lib/store/useGameConnection";
import { useGameStore } from "@/lib/store/gameStore";
import { useHelpStore } from "@/lib/store/helpStore";
import { useAudioEffects } from "@/lib/audio/useAudioEffects";
import { AudioControls } from "@/components/audio";
import { HelpToggle, PassWarningDialog, TurnBanner } from "@/components/help";
import { Button, Heading, ScreenContainer } from "@/components/ui";
import Board from "./Board";
import HandCards from "./HandCards";
import ActionButtons from "./ActionButtons";
import OpponentArea from "./OpponentArea";

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
  const send = useGameStore((s) => s.send);
  const helpMode = useHelpStore((s) => s.helpMode);
  const [selected, setSelected] = useState<Card | null>(null);
  const [passWarnOpen, setPassWarnOpen] = useState(false);

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
  const isMyTurn = current?.seat === mySeat;
  const canPlay = isMyTurn && !!selected && isPlayable(selected, gameState.board);

  const handlePlay = () => {
    if (!canPlay || !selected) return;
    send({ type: "play", card: selected });
    setSelected(null);
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
          <h1 className="text-2xl font-bold">7並べ</h1>
          <div className="flex flex-wrap items-center gap-3">
            <HelpToggle />
            <AudioControls />
          </div>
        </div>

        <OpponentArea players={opponents} currentSeat={gameState.currentSeat} />

        <Board board={gameState.board} />

        {ended ? (
          <Results state={gameState} mySeat={mySeat} onBack={backToTitle} />
        ) : (
          <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/40 p-4">
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
              <ActionButtons canPlay={canPlay} onPlay={handlePlay} onPass={handlePass} />
            )}
          </div>
        )}
      </div>

      <PassWarningDialog
        open={passWarnOpen}
        onConfirm={doPass}
        onCancel={() => setPassWarnOpen(false)}
      />
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
