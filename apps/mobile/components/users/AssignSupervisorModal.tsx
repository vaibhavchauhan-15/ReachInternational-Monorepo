/**
 * ReachInternational Mobile — Assign Supervisor Modal
 *
 * Standardized reporting supervisor assignment modal using reusable
 * assignment primitives with TanStack Query caching and optimistic rollback.
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 * - Self-assignment prevention (s.id !== user.id && selectedId === user.id)
 * - Synchronous savingRef mutex (savingRef = React.useRef(false))
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  AssignmentBottomSheet,
  AssignmentSearchInput,
  AssignmentSelectableList,
  AssignmentActionBar,
  TargetEntityDetails,
  AssignmentCandidateItem,
} from '../assignments';
import { useToast } from '../ui';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import type { UserRecord } from './UserDetailModal';

export interface AssignSupervisorModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: (patch?: Partial<UserRecord>) => void;
}

interface SupervisorItem {
  id: string;
  full_name: string;
  employee_id?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
}

export const AssignSupervisorModal: React.FC<AssignSupervisorModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savingRef = React.useRef(false);

  // Load eligible supervisors using TanStack Query
  const { data: supervisors = [], isLoading } = useQuery<SupervisorItem[]>({
    queryKey: ['assign-supervisor-modal', 'supervisors'],
    enabled: visible,
    staleTime: 60_000,
    queryFn: async () => {
      // First try RPC get_active_supervisors_public
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_active_supervisors_public');
      if (!rpcErr && rpcData && Array.isArray(rpcData)) {
        return rpcData as SupervisorItem[];
      }

      // Fallback: direct query
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

  // Sync state on open
  useEffect(() => {
    if (visible && user) {
      savingRef.current = false;
      setSelectedId(user.supervisor_id || (user.supervisors?.[0]?.id ?? null));
      setSearch('');
      setIsSaving(false);
      setSubmitError(null);
    }
  }, [visible, user]);

  // Filter candidates & prevent assigning self as supervisor
  const candidateItems = useMemo((): AssignmentCandidateItem[] => {
    const list = supervisors.filter((s) => !user || s.id !== user.id);
    const q = search.trim().toLowerCase();

    return list
      .filter((s) => {
        if (!q) return true;
        return (
          s.full_name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.employee_id?.toLowerCase().includes(q)
        );
      })
      .map((s) => ({
        id: s.id,
        title: s.full_name,
        code: s.employee_id || null,
        subtitle: `${s.role.toUpperCase()} • ${s.phone || s.email || 'Contact on file'}`,
        entityType: 'user',
      }));
  }, [supervisors, search, user]);

  const selectedSupervisor = useMemo(() => {
    return supervisors.find((s) => s.id === selectedId) || null;
  }, [supervisors, selectedId]);

  const initialSupervisorId = user?.supervisor_id || (user?.supervisors?.[0]?.id ?? null);
  const hasUnsavedChanges = selectedId !== initialSupervisorId;

  const handleSave = async () => {
    if (!user) return;
    if (savingRef.current) return;
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
      const { error: userErr } = await supabase
        .from('users')
        .update({
          supervisor_id: selectedId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // Sync user_supervisors junction table
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

      // Invalidate relevant query keys
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

      const patch: Partial<UserRecord> = {
        supervisor_id: selectedId,
        supervisors: selectedSupervisor ? [selectedSupervisor as any] : [],
      };
      onSuccess(patch);
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
    title: user?.full_name || 'User Profile',
    code: user?.employee_id || 'USER',
    subtitle: (user?.role || 'user').toUpperCase(),
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
      <AssignmentSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search supervisors by name or ID..."
        count={candidateItems.length}
        totalCount={supervisors.length}
      />

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
