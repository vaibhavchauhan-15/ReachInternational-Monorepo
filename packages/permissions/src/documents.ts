/**
 * ReachInternational Document Access RBAC Rules
 * Enforces who can view, verify, and reject user identity and banking documents.
 * 
 * Access Matrix:
 * - super_admin, admin, hr: All users, all documents, verify / reject.
 * - manager, supervisor: None by default (optionally driving_license of own team).
 * - operator: Own documents only.
 */

export interface DocumentViewerSubject {
  id: string;
  role?: string | null;
}

export interface DocumentTargetSubject {
  id: string;
}

export interface DocumentAccessContext {
  isTeamMember?: boolean;
}

const PRIVILEGED_DOCUMENT_ROLES = ["super_admin", "admin", "hr"] as const;
const FIELD_SUPERVISORY_ROLES = ["manager", "supervisor"] as const;

function normalizeRole(role?: string | null): string {
  return (role || "").toLowerCase().trim().replace(/[\s-]/g, "_");
}

/**
 * Checks whether a viewer is authorized to view a target user's document.
 * 
 * Rules:
 * 1. Self-access is always permitted (viewer.id === target.id).
 * 2. Privileged staff (super_admin, admin, hr) can view all documents of all users.
 * 3. Manager and Supervisor: None by default, but can view driving_license of own team members.
 * 4. Operator and all other roles: Own documents only.
 */
export function canViewDocument(
  viewer: DocumentViewerSubject | null | undefined,
  target: DocumentTargetSubject | null | undefined,
  docType?: string,
  context?: DocumentAccessContext
): boolean {
  if (!viewer || !target) return false;
  if (!viewer.id || !target.id) return false;

  // Rule 1: Self-access is always permitted
  if (viewer.id === target.id) return true;

  const role = normalizeRole(viewer.role);

  // Rule 2: Privileged management staff (super_admin, admin, hr)
  if (PRIVILEGED_DOCUMENT_ROLES.includes(role as any)) {
    return true;
  }

  // Rule 3: Manager and Supervisor (only driving_license of own team members)
  if (FIELD_SUPERVISORY_ROLES.includes(role as any)) {
    if (docType === "driving_license" && context?.isTeamMember === true) {
      return true;
    }
    return false;
  }

  // Rule 4: Operator & unprivileged roles cannot view another user's documents
  return false;
}

/**
 * Checks whether a viewer is authorized to verify a user's document.
 * Strictly limited to super_admin, admin, and hr.
 */
export function canVerifyDocument(viewer: DocumentViewerSubject | null | undefined): boolean {
  if (!viewer || !viewer.id) return false;
  const role = normalizeRole(viewer.role);
  return PRIVILEGED_DOCUMENT_ROLES.includes(role as any);
}

/**
 * Checks whether a viewer is authorized to reject a user's document.
 * Strictly limited to super_admin, admin, and hr.
 */
export function canRejectDocument(viewer: DocumentViewerSubject | null | undefined): boolean {
  if (!viewer || !viewer.id) return false;
  const role = normalizeRole(viewer.role);
  return PRIVILEGED_DOCUMENT_ROLES.includes(role as any);
}
