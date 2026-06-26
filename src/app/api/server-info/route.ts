// サーバーのLAN情報。ホスト画面が QR/URL を組み立てるために使う。
// ブラウザ（特にホストPCの localhost）からは自分のLAN IPが分からないので、サーバーが返す。

import os from "node:os";

export const dynamic = "force-dynamic"; // 起動環境に依存するのでキャッシュしない

/** 非内部 IPv4（LANアドレス）の一覧。 */
const lanIPv4 = (): string[] =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

export function GET() {
  const port = Number(process.env.PORT ?? 3000);
  const ips = lanIPv4();
  const ip = ips[0] ?? "localhost";
  return Response.json({ ip, ips, port, url: `http://${ip}:${port}` });
}
