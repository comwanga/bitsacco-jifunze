import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  // Bound static-export worker memory on small builders and the maintainer's workstation.
  experimental: { cpus: 2 },
};

export default nextConfig;
