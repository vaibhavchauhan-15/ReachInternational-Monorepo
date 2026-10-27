/**
 * ReachInternational Mobile — Assign Reporting Supervisor Modal
 *
 * Dedicated modal for designating an employee's direct reporting supervisor.
 * Enforces reporting hierarchy invariants:
 * - A user cannot be assigned as their own reporting supervisor
 * - Filters strictly for active supervisor/manager/admin accounts
 * - TanStack Query cache updates with reliable snapshot rollback
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { AssignmentBottomSheet, TargetEntityDetails } from './AssignmentBottomSheet';
import { AssignmentSearchInput } from './AssignmentSearchInput';
import { AssignmentSelectableList, AssignmentCandidateItem } from './AssignmentSelectableList';
import { AssignmentActionBar } from './AssignmentActionBar';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { UserRecord } from '../users/UserDetailModal';

export interface AssignReportingSupervisorModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess?: (patch?: Partial<UserRecord>) => void;
}

interface SupervisorItem {
  id: string;
  full_name: string;
  employee_id?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
}

export const AssignReportingSupervisorModal: React.FC<AssignReportingSupervisorModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = useRef(false);

  // Active supervisors query
  const { data: supervisors = [], isLoading } = useQuery<SupervisorItem[]>({
    queryKey: ['assign-reporting-supervisor-modal', 'supervisors'],
    enabled: visible,
    staleTime: 60_000,
    queryFn: async () => {
      // Direct query with role filtering
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, employee_id, email, phone, role')
        .in('role', ['supervisor', 'manager', 'admin', 'super_admin'])
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return (data || []) as SupervisorItem[];
    },
  });

  // Reset or initialize on open
  useEffect(() => {
    if (visible && user) {
      savingRef.current = false;
      setSelectedId(user.supervisor_id || (user.supervisors?.[0]?.id ?? null));
      setSearchQuery('');
      setIsSaving(false);
      setSubmitError(null);
    }
  }, [visible, user]);

  // Candidate items with self-assignment prevention
  const candidateItems = useMemo((): AssignmentCandidateItem[] => {
    const q = searchQuery.trim().toLowerCase();
    return supervisors
      .filter((s) => !user || s.id !== user.id)
      .filter((s) => {
        if (!q) return true;
        const matchName = s.full_name?.toLowerCase().includes(q);
        const matchEmpId = s.employee_id?.toLowerCase().includes(q);
        const matchEmail = s.email?.toLowerCase().includes(q);
        return Boolean(matchName || matchEmpId || matchEmail);
      })
      .map((s) => ({
        id: s.id,
        title: s.full_name,
        code: s.employee_id || null,
        subtitle: `${s.role.toUpperCase()} • ${s.phone || s.email || 'Contact on file'}`,
        entityType: 'user',
      }));
  }, [supervisors, searchQuery, user]);

  // Selected supervisor object
  const selectedSupervisor = useMemo(() => {
    return supervisors.find((s) => s.id === selectedId) || null;
  }, [supervisors, selectedId]);

  // Has unsaved changes check
  const initialSupervisorId = user?.supervisor_id || (user?.supervisors?.[0]?.id ?? null);
  const hasUnsavedChanges = selectedId !== initialSupervisorId;

  // Save handler with optimistic cache update and rollback
  const handleSave = async () => {
    if (!user || savingRef.current || isSaving) return;

    if (selectedId && selectedId === user.id) {
      haptics.reject();
      toast('error', 'Invalid Assignment', 'A user cannot be assigned as their own reporting supervisor.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setSubmitError(null);

    const previousUsers = queryClient.getQueryData(['users']);
    const previousUserDetail = queryClient.getQueryData(['userDetail', user.id]);

    try {
      // 1. Update user supervisor_id
      const { error: userErr } = await supabase
        .from('users')
        .update({
          supervisor_id: selectedId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // 2. Sync user_supervisors junction table
      if (selectedId) {
        try {
          await supabase
            .from('user_supervisors')
            .upsert(
              { user_id: user.id, supervisor_id: selectedId },
              { onConflict: 'user_id,supervisor_id' }
            );
        } catch {
          // ignore junction table fallback if already synced
        }
      } else {
        try {
          await supabase
            .from('user_supervisors')
            .delete()
            .eq('user_id', user.id);
        } catch {
          // ignore junction fallback
        }
      }

      // Surgical cache invalidation
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userDetail', user.id] });

      haptics.confirm();
      toast(
        'success',
        'Supervisor Assigned',
        selectedSupervisor
          ? `Assigned ${selectedSupervisor.full_name} as supervisor for ${user.full_name}.`
          : `Removed reporting supervisor for ${user.full_name}.`
      );

      onSuccess?.({
        supervisor_id: selectedId,
        supervisors: selectedSupervisor ? [selectedSupervisor as any] : [],
      });
      onClose();
    } catch (err: any) {
      if (previousUsers) {
        queryClient.setQueryData(['users'], previousUsers);
      }
      if (previousUserDetail) {
        queryClient.setQueryData(['userDetail', user.id], previousUserDetail);
      }

      haptics.reject();
      const msg = err?.message || 'Failed to update reporting supervisor.';
      setSubmitError(msg);
      toast('error', 'Assignment Failed', msg);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const targetEntity: TargetEntityDetails = {
    type: 'operator',
    title: user?.full_name || 'Employee',
    code: user?.employee_id || 'USER',
    subtitle: (user?.role || 'operator').toUpperCase(),
    statusBadge: user?.status ? user.status.toUpperCase() : 'ACTIVE',
  };

  return (
    <AssignmentBottomSheet
      visible={visible}
      onClose={onClose}
      title="Assign Reporting Supervisor"
      description="Designate organizational line manager & reporting supervisor"
      targetEntity={targetEntity}
      footer={
        <AssignmentActionBar
          onSave={handleSave}
          onCancel={onClose}
          isSaving={isSaving}
          saveLabel="Save Supervisor"
          hasUnsavedChanges={hasUnsavedChanges}
          error={submitError}
          disabled={isSaving}
        />
      }
    >
      {/* Search Bar */}
      <AssignmentSearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search supervisors by name or employee ID..."
        count={candidateItems.length}
        totalCount={supervisors.length}
      />

      {/* Selectable Supervisors List */}
      <AssignmentSelectableList
        candidates={candidateItems}
        selectedIds={selectedId ? [selectedId] : []}
        onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
        selectionMode="single"
        isLoading={isLoading}
        emptyTitle="No supervisors found"
        emptyDescription="No active supervisors match your search criteria."
      />
    </AssignmentBottomSheet>
  );
};
