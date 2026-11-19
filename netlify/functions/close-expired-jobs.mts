/**
 * Netlify Scheduled Function: close-expired-jobs
 * Schedule: 0 0 * * * (Daily at 00:00 UTC)
 * Dispatches to /api/cron/close-expired-jobs with CRON_SECRET authorization.
 */
export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://dashboard-reachinternational.vercel.app";
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SECRET_KEY || "";

  try {
    const endpoint = `${siteUrl.replace(/\/$/, "")}/api/cron/close-expired-jobs`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.text();
    console.log(`[Netlify Cron] close-expired-jobs status ${res.status}: ${body}`);
    return new Response(body, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Netlify Cron] close-expired-jobs failed:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const config = {
  schedule: "0 0 * * *",
};
