import GameTable from '@/components/game/GameTable'

// Server Component のまま。インタラクティブな対局UIは GameTable（Client）に委譲する。
export default function Home() {
  return <GameTable />
}
