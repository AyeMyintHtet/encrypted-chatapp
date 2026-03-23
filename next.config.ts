import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
