/**
 * ServiceCentric Design Tokens — Universal Badge & Status Contract
 * Single source of truth for status badges across Web and Mobile.
 */

export interface BadgeConfig {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'overdue' | 'neutral';
  colorToken: string;
  bgToken: string;
}

export const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  // Machine Statuses
  active: { label: 'Active', variant: 'success', colorToken: 'success', bgToken: 'successSoft' },
  inactive: { label: 'Inactive', variant: 'neutral', colorToken: 'mute', bgToken: 'hairlineSoft' },
  on_rent: { label: 'On Rent', variant: 'info', colorToken: 'link', bgToken: 'linkSoft' },
  under_maintenance: { label: 'Under Maintenance', variant: 'warning', colorToken: 'warningDeep', bgToken: 'warningSoft' },

  // Complaint Statuses
  open: { label: 'Open', variant: 'warning', colorToken: 'warningDeep', bgToken: 'warningSoft' },
  in_progress: { label: 'In Progress', variant: 'info', colorToken: 'link', bgToken: 'linkSoft' },
  resolved: { label: 'Resolved', variant: 'success', colorToken: 'success', bgToken: 'successSoft' },
  closed: { label: 'Closed', variant: 'neutral', colorToken: 'mute', bgToken: 'hairlineSoft' },

  // FSR & Document Review Statuses
  draft: { label: 'Draft', variant: 'neutral', colorToken: 'mute', bgToken: 'hairlineSoft' },
  submitted: { label: 'Submitted', variant: 'info', colorToken: 'link', bgToken: 'linkSoft' },
  approved: { label: 'Approved', variant: 'success', colorToken: 'success', bgToken: 'successSoft' },
  revision_requested: { label: 'Revision Requested', variant: 'error', colorToken: 'error', bgToken: 'errorSoft' },

  // Purchase Order & Challan Statuses
  pending_approval: { label: 'Pending Approval', variant: 'pending', colorToken: 'pending', bgToken: 'pendingSoft' },
  completed: { label: 'Completed', variant: 'success', colorToken: 'success', bgToken: 'successSoft' },
  cancelled: { label: 'Cancelled', variant: 'error', colorToken: 'error', bgToken: 'errorSoft' },

  // Employee Lifecycle Statuses
  pending_onboarding: { label: 'Pending Onboarding', variant: 'pending', colorToken: 'pending', bgToken: 'pendingSoft' },
  on_leave: { label: 'On Leave', variant: 'warning', colorToken: 'warningDeep', bgToken: 'warningSoft' },
  notice_period: { label: 'Notice Period', variant: 'error', colorToken: 'error', bgToken: 'errorSoft' },
  resigned: { label: 'Resigned', variant: 'neutral', colorToken: 'mute', bgToken: 'hairlineSoft' },
  terminated: { label: 'Terminated', variant: 'error', colorToken: 'errorDeep', bgToken: 'errorSoft' },
  retired: { label: 'Retired', variant: 'neutral', colorToken: 'mute', bgToken: 'hairlineSoft' },
  archived: { label: 'Archived', variant: 'neutral', colorToken: 'faint', bgToken: 'hairlineSoft' },
};

export function getStatusBadgeConfig(status: string, fallbackLabel?: string): BadgeConfig {
  const normalizedKey = status.toLowerCase();
  if (BADGE_CONFIGS[normalizedKey]) {
    return BADGE_CONFIGS[normalizedKey];
  }
  return {
    label: fallbackLabel || status.replace(/_/g, ' '),
    variant: 'neutral',
    colorToken: 'mute',
    bgToken: 'hairlineSoft',
  };
}
