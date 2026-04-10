import { MetadataRoute } from "next";

/**
 * robots.ts — Generates a valid robots.txt file at runtime.
 *
 * This tool fixes the "robots.txt is not valid" error by providing a
 * correctly formatted response that crawlers (Google, Bing, etc.)
 * can understand.
 *
 * For this encrypted chat application:
 * 1. We Allow indexing of the home/landing page (/).
 * 2. We Disallow indexing of private/protected routes (/dashboard, /chat).
 * 3. We Disallow indexing of API routes (/api).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/chat/"],
    },
    sitemap: "https://cqgram.vercel.app/sitemap.xml",
  };
}
