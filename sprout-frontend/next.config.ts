import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@excalidraw/excalidraw"],
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
