import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "./blog/posts";

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (productionHost ? `https://${productionHost}` : "http://localhost:3000");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = "2026-09-01";
  return [
    { url: siteUrl, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/blog`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    ...BLOG_POSTS.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
