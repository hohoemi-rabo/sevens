import os from "node:os";
import type { NextConfig } from "next";

// dev 時、他端末が http://<lan-ip>:3000 で開くと Next が cross-origin として警告/制限する。
// 起動マシンの LAN IPv4 を allowedDevOrigins に入れて許可する（本番ビルドには影響しない）。
const lanIPv4 = (): string[] =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanIPv4(),
};

export default nextConfig;
