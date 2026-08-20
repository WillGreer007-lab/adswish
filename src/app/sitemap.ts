import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://adswish.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/legal/subprocessors`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/legal/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${baseUrl}/guides/creators/getting-started`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/guides/businesses/launching`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/guides/engineering/pixel-integration`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/guides/businesses/google-ads`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
