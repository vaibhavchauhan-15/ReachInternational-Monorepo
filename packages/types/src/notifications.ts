/**
 * ReachInternational In-App Notification Shared Types (@reachinternational/types)
 */

export type NotificationCategory =
  | 'shift_reminder'
  | 'breakdown'
  | 'assignment'
  | 'admin'
  | 'approvals'
  | 'security'
  | 'payroll'
  | 'log_entry'
  | 'system';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export type NotificationRouteKey =
  | 'operations'
  | 'machines'
  | 'users'
  | 'approvals'
  | 'payroll'
  | 'attendance'
  | 'rfq'
  | 'settings'
  | 'dashboard';

export interface NotificationCursor {
  created_at: string;
  id: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory | string;
  priority: NotificationPriority;
  severity: NotificationSeverity | string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  route_key: NotificationRouteKey | string | null;
  route_params: Record<string, any>;
  deep_link: string | null;
  metadata: Record<string, any>;
}

export interface NotificationListResult {
  items: NotificationItem[];
  next_cursor: NotificationCursor | null;
  has_more: boolean;
  unread_count: number;
}

export interface NotificationListParams {
  cursor_created_at?: string | null;
  cursor_id?: string | null;
  limit?: number;
  filter?: 'all' | 'unread';
}

export interface NotificationMarkReadInput {
  notification_ids: string[];
}

export interface NotificationMarkAllReadInput {
  before_cursor?: string | null;
}
