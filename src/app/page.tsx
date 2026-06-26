// トップ画面（Server Component）。部屋を作る / 部屋に入る は Link 遷移、
// ひとりで遊ぶ は Client の SoloStartButton に委譲する。

import Link from "next/link";
import { Heading, ScreenContainer, buttonVariants } from "@/components/ui";
import { SoloStartButton } from "@/components/room/SoloStartButton";

export default function Home() {
  return (
    <ScreenContainer>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
        <Heading level={1} className="text-2xl">
          7並べ
        </Heading>
        <p className="max-w-md text-base text-foreground/80">
          ほほ笑みラボの、みんなで遊ぶ4人対戦7並べです。
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link href="/host" className={buttonVariants({ variant: "primary", size: "lg" })}>
            部屋を作る
          </Link>
          <Link href="/join" className={buttonVariants({ variant: "primary", size: "lg" })}>
            部屋に入る
          </Link>
          <SoloStartButton />
        </div>
      </div>
    </ScreenContainer>
  );
}
