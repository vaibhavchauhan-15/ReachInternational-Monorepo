import "server-only";

/**
 * Cloudflare Turnstile Verification Helper (Optional abuse control)
 * When TURNSTILE_SECRET_KEY is configured in the environment, verifies the challenge token.
 * When not configured, seamlessly permits the operation without friction.
 */
export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  // If Turnstile is not configured, abuse control is disabled/optional
  if (!secretKey) {
    return { success: true };
  }

  if (!token?.trim()) {
    return { success: false, error: "Cloudflare Turnstile verification challenge token required" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { success: false, error: `Turnstile verify service returned HTTP ${response.status}` };
    }

    const outcome = (await response.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!outcome.success) {
      const errList = outcome["error-codes"]?.join(", ") || "Turnstile validation failed";
      return { success: false, error: errList };
    }

    return { success: true };
  } catch (err) {
    console.error("[Turnstile] Verification request failed:", err);
    return { success: false, error: "Failed to communicate with Turnstile verification service" };
  }
}
