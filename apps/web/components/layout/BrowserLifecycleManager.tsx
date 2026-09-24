/**
 * BrowserLifecycleManager
 * - Lifecycle manager component for the web application shell.
 * - Adheres strictly to standard browser navigation: reloading any page (F5/Cmd+R)
 *   preserves the user on their current page without unnecessary redirection to Home.
 * - Initial entry to the site (/) or post-login redirection is handled authoritatively
 *   by proxy.ts and app/actions/auth.ts.
 */
export function BrowserLifecycleManager() {
  return null;
}

