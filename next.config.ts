import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests from 192.168.1.x devices (e.g. phones on the same LAN) in dev mode.
  // Without this, Next.js will warn about cross-origin requests to /_next/* resources.
  allowedDevOrigins: ["192.168.1.66"],
  experimental: {
    // optimizePackageImports: ["lucide-react", "@supabase/supabase-js", "@tanstack/react-query"],
    inlineCss: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
