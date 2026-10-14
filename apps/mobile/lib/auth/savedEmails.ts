/**
 * Reach International Mobile — Saved Non-Sensitive Login Email Suggestions
 *
 * SECURITY INVARIANT:
 * Stores ONLY public, non-sensitive email strings for convenient autofill suggestions.
 * NEVER stores, caches, or suggests passwords or sensitive credentials.
 * Passwords strictly rely on OS-level Android Autofill / iOS Keychain / Password Managers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SAVED_EMAILS = '@reach_saved_login_emails';
const STORAGE_KEY_REMEMBERED_EMAIL = '@reach_remembered_email';
const STORAGE_KEY_REMEMBER_ME_FLAG = '@reach_remember_me_flag';
const MAX_SAVED_EMAILS = 5;

/**
 * Retrieve list of previously used login email addresses (up to 5 most recent).
 */
export async function getSavedEmails(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SAVED_EMAILS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.includes('@'));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save an email address into suggestion history upon successful login.
 * Trims, lowercases, deduplicates, and limits to MAX_SAVED_EMAILS.
 */
export async function saveEmailSuggestion(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return;

  try {
    const current = await getSavedEmails();
    const filtered = current.filter((e) => e !== normalized);
    const updated = [normalized, ...filtered].slice(0, MAX_SAVED_EMAILS);
    await AsyncStorage.setItem(STORAGE_KEY_SAVED_EMAILS, JSON.stringify(updated));
  } catch {
    // Non-fatal error; ignore storage failures
  }
}

/**
 * Remove a specific email address from the saved suggestions list.
 */
export async function removeSavedEmail(email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  try {
    const current = await getSavedEmails();
    const updated = current.filter((e) => e !== normalized);
    await AsyncStorage.setItem(STORAGE_KEY_SAVED_EMAILS, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Get the remembered email address if "Remember me" was enabled.
 */
export async function getRememberedEmail(): Promise<{ email: string; rememberMe: boolean }> {
  try {
    const [email, flag] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL),
      AsyncStorage.getItem(STORAGE_KEY_REMEMBER_ME_FLAG),
    ]);

    const rememberMe = flag === 'true';
    return {
      email: rememberMe && email ? email : '',
      rememberMe,
    };
  } catch {
    return { email: '', rememberMe: false };
  }
}

/**
 * Update the "Remember me" preference and remembered email upon sign in.
 */
export async function setRememberedEmail(email: string, rememberMe: boolean): Promise<void> {
  try {
    if (rememberMe && email.trim()) {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, email.trim().toLowerCase()),
        AsyncStorage.setItem(STORAGE_KEY_REMEMBER_ME_FLAG, 'true'),
        saveEmailSuggestion(email),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL),
        AsyncStorage.setItem(STORAGE_KEY_REMEMBER_ME_FLAG, 'false'),
      ]);
    }
  } catch {
    // Non-fatal error; ignore storage failures
  }
}
