import { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env/client";

export default function robots(): MetadataRoute.Robots {
  let baseUrl = "https://www.reachinternational.co.in";
  try {
    baseUrl = getAppUrl();
  } catch {
    // fallback to production domain
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/equipment",
          "/equipment/",
          "/contact",
          "/contact/",
          "/careers",
          "/careers/",
          "/login",
          "/privacy",
          "/terms",
          "/account-deletion-guide",
          "/delete-account",
        ],
        disallow: [
          "/api/",
          "/careers/preview/",
          "/careers/apply/success",
          "/hiring/",
          "/dashboard/",
          "/machines/",
          "/operations/",
          "/clients/",
          "/payroll/",
          "/users/",
          "/settings/",
          "/attendance/",
          "/onboarding/",
        ],
      },
      {
        // Dedicated directives for AI Agent crawlers & LLMs (Perplexity, OpenAI, Anthropic, Apple)
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Applebot",
          "Applebot-Extended",
          "Google-Extended",
          "Amazonbot",
        ],
        allow: [
          "/",
          "/equipment",
          "/equipment/",
          "/contact",
          "/contact/",
          "/careers",
          "/careers/",
          "/privacy",
          "/terms",
          "/llms.txt",
        ],
        disallow: [
          "/api/",
          "/careers/preview/",
          "/careers/apply/success",
          "/hiring/",
          "/dashboard/",
          "/machines/",
          "/operations/",
          "/clients/",
          "/payroll/",
          "/users/",
          "/settings/",
          "/attendance/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
