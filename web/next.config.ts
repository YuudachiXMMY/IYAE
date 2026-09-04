import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/internal/:path*",
        destination: "/api/internal/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiProxyTarget}/uploads/:path*`,
      },
      {
        source: "/assets/:path*",
        destination: `${apiProxyTarget}/assets/:path*`,
      },
    ];
  },
};

export default nextConfig;
