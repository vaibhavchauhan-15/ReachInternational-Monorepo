import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy Account Deletion route redirect.
 * Redirects visitors and automated scanners permanently to /account-deletion-guide.
 */
export default function LegacyAccountDeletionRedirect() {
  permanentRedirect("/account-deletion-guide");
}
