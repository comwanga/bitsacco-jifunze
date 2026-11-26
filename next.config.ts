import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // Bound static-export worker memory on small builders and the maintainer's workstation.
  // globalNotFound: one bilingual 404 for unmatched URLs, needed because the app has two root layouts.
  experimental: { cpus: 2, globalNotFound: true },
};

export default nextConfig;
