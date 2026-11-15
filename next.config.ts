import type { NextConfig } from "next";

function r2RemotePatterns() {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) return [];
  try {
    const parsed = new URL(url);
    return [{ protocol: parsed.protocol.replace(":", "") as "https" | "http", hostname: parsed.hostname, pathname: "/**" }];
  } catch {
    return [];
  }
}

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  distDir: process.env.ADMIN_INTEGRATION_TEST === "1" ? ".next-integration" : ".next",
  images: {
    remotePatterns: r2RemotePatterns(),
  },
};
export default config;
