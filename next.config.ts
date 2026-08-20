import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The map owns a long-lived imperative WebGL scene. React's development-only
  // Strict Mode remount tears down the first canvas and immediately creates a
  // second one, making large startup layers such as the rivers visibly flash.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/models/:asset*.glb",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/models/washington-city/:tile*.glb",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/models/washington-city/:metadata*.json",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/data/:dataset*.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
