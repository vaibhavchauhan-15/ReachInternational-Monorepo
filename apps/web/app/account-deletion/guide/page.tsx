import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Account Deletion Guide route redirect.
 * Redirects visitors and mobile shared links permanently to /account-deletion-guide.
 */
export default function AccountDeletionGuideRedirect() {
  permanentRedirect("/account-deletion-guide");
}
