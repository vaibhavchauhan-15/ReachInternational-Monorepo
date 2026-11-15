import type { UserRole, User } from "./database";

// ─── Approval Status & Decision Enums ────────────────────────────────

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type ApprovalDecisionType = "approve" | "reject";

export type ApprovalAction = "submit" | "view" | "decide";

export type ApprovalEntityCategory =
  | "user"
  | "document"
  | "operations"
  | "finance"
  | "security";

// ─── Core Type Catalogue ─────────────────────────────────────────────

export interface ApprovalType {
  key: string;
  label: string;
  category: ApprovalEntityCategory | string;
  approver_roles: UserRole[];
  required_approvals: number;
  allow_self_approve: boolean;
  ttl: string | null;
  cooling_off: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Core Request Entity ─────────────────────────────────────────────

export interface ApprovalRequest<TPayload = Record<string, unknown>> {
  id: string;
  type_key: string;
  subject_type: string;
  subject_id: string | null;
  subject_label?: string | null;
  requested_by: string;
  requester_name?: string | null;
  status: ApprovalStatus;
  summary: string;
  payload: TPayload;
  decision_note?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  expires_at?: string | null;
  supersedes_id?: string | null;
  idempotency_key?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  type?: ApprovalType | null;
  requester?: Pick<User, "id" | "full_name" | "email" | "role"> | null;
}

export interface ApprovalRequestListItem {
  id: string;
  type_key: string;
  type_label: string;
  subject_type: string;
  subject_id: string | null;
  subject_label?: string | null;
  requested_by: string;
  requester_name?: string | null;
  status: ApprovalStatus;
  summary: string;
  priority: number;
  created_at: string;
  expires_at?: string | null;
  version: number;
}

// ─── Decisions & Multi-Approver ──────────────────────────────────────

export interface ApprovalDecision {
  request_id: string;
  approver_id: string;
  approver_role: UserRole;
  decision: ApprovalDecisionType;
  note?: string | null;
  created_at: string;
  approver?: Pick<User, "id" | "full_name" | "email"> | null;
}

// ─── Append-Only Event Stream ────────────────────────────────────────

export interface ApprovalEvent {
  id: number;
  request_id: string;
  actor_id: string | null;
  actor_role?: string | null;
  action: string;
  from_status?: ApprovalStatus | null;
  to_status?: ApprovalStatus | null;
  note?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  actor?: Pick<User, "id" | "full_name" | "email"> | null;
}

// ─── Post-Commit Outbox ──────────────────────────────────────────────

export interface ApprovalOutboxItem {
  id: number;
  topic: string;
  request_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at?: string | null;
}

// ─── Counters & Summaries ───────────────────────────────────────────

export interface ApprovalCounts {
  total: number;
  by_type: Record<string, number>;
}

// ─── Per-Type Payload Types ──────────────────────────────────────────

export interface ProfileChangeFieldDelta {
  field: string;
  new_value: string | number | boolean | null;
  old_value?: string | number | boolean | null;
}

export interface ProfileChangePayload {
  changes: Record<string, { old_value?: unknown; new_value: unknown }>;
  target_user_id: string;
  requester_role?: string;
  reason?: string;
}

export interface RegistrationPayload {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  machine_category?: string | null;
}

export interface DocumentVerifyPayload {
  document_id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  thumb_path?: string | null;
}

export interface DocumentReplacePayload {
  document_type_code: string;
  user_id: string;
  staging_path: string;
  staging_thumb_path?: string | null;
  current_storage_path?: string | null;
}

export interface AccountDeletionPayload {
  user_id: string;
  email?: string;
  full_name?: string;
  reason: string;
  source: "web" | "mobile" | "public_web";
}

export interface ShiftConflictPayload {
  log_id: string;
  machine_id: string;
  operator_id: string;
  action: "acknowledge" | "adjust";
  adjusted_start_time?: string;
  adjusted_end_time?: string;
  remarks?: string;
}
