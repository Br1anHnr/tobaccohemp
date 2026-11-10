import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  distDir: process.env.GOLDEN_IMAGE_INTEGRATION_TEST === "1" ? ".next-integration" : ".next",
};
export default config;
