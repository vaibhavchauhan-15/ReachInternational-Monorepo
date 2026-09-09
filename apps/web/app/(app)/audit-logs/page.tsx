import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect: /audit-logs → /audit
 * The centralized audit module now lives at /audit.
 */
export default function AuditLogsRedirectPage() {
  redirect("/audit");
}
