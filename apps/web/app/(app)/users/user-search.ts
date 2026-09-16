import type { User } from "@/lib/types/database";
import {
  buildSearchIndex,
  searchIndexedItems,
  type IndexedItem,
} from "@reachinternational/utils";
import { highlightText } from "@/components/ui/Highlight";

export type IndexedUser = IndexedItem<User>;

/**
 * Build a flat search index for users with pre-computed lowercase blobs.
 * Indexes name, phone (both formatted and pure digits), and email.
 */
export function buildUserSearchIndex(users: User[]): IndexedUser[] {
  return buildSearchIndex(users, (u) => [
    u.full_name,
    u.phone,
    u.email,
  ]);
}

/**
 * Filter the pre-built user search index by a multi-term query.
 * Multi-term AND matching across name, phone (digits or raw), and email.
 */
export function searchUsers(index: IndexedUser[], query: string): User[] {
  return searchIndexedItems(index, query);
}

export { highlightText };
