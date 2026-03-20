import { MetadataRoute } from "next";

/**
 * sitemap.ts — Generates a dynamic sitemap.xml for SEO engines.
 * 
 * Includes the main landing page and auth routes, but purposefully
 * excludes private /dashboard and /chat paths to handle security
 * and privacy expectations for an encrypted chatapp.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://chatapp-encrypted.vercel.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
