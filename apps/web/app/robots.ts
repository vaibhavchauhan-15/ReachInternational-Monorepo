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
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/privacy", "/terms", "/account-deletion-guide", "/delete-account"],
      disallow: [
        "/api/",
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
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
