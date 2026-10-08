/**
 * Optimistic UI Architecture — usePendingMutation Hook (Tier 3)
 *
 * Implements the Tier 3 Pending-Confirmed contract:
 * - Immediate in-place pending state (button progress, locked inputs, dimmed rows) within 1 frame (≤ 16ms - 100ms).
 * - Zero premature/fake cache patching (critical for money, payroll, security, roles, and identity).
 * - Commits only upon verified server acknowledgment.
 * - Haptic press and confirm feedback.
 * - Automatic double-submission prevention.
 * - Human-friendly PG error mapping.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { haptics } from '../haptics';
import { defaultFormatErrorMessage } from './useOptimisticMutation';
import { postNotification } from '../notifications/postNotification';

export interface UsePendingMutationOptions<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidateQueries?: QueryKey[] | ((data: TData, vars: TVars) => QueryKey[]);
  successMessage?: string | ((data: TData, vars: TVars) => string);
  errorMessage?: (error: any) => string;
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: any, vars: TVars) => void;
}

export function usePendingMutation<TData, TVars>(
  options: UsePendingMutationOptions<TData, TVars>
) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mutation = useMutation<TData, any, TVars>({
    mutationFn: async (vars: TVars) => {
      // Immediate tactile feedback upon trigger
      haptics.select();
      return options.mutationFn(vars);
    },

    onMutate: () => {
      setIsSubmitting(true);
    },

    onSuccess: (data, vars) => {
      setIsSubmitting(false);
      haptics.confirm();

      const formatFn = options.errorMessage || defaultFormatErrorMessage;
      if (options.successMessage) {
        const msg =
          typeof options.successMessage === 'function'
            ? options.successMessage(data, vars)
            : options.successMessage;

        postNotification({
          category: 'system',
          title: 'Completed',
          body: msg,
          severity: 'info',
        });
      }

      if (options.invalidateQueries) {
        const keys =
          typeof options.invalidateQueries === 'function'
            ? options.invalidateQueries(data, vars)
            : options.invalidateQueries;

        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      if (options.onSuccess) {
        options.onSuccess(data, vars);
      }
    },

    onError: (error, vars) => {
      setIsSubmitting(false);
      haptics.reject();

      const formatFn = options.errorMessage || defaultFormatErrorMessage;
      const errorMsg = formatFn(error);

      postNotification({
        category: 'system',
        title: 'Action Failed',
        body: errorMsg,
        severity: 'error',
      });

      if (options.onError) {
        options.onError(error, vars);
      }
    },

    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const mutate = useCallback(
    (vars: TVars) => {
      if (isSubmitting || mutation.isPending) {
        // Prevent accidental double-taps
        return;
      }
      mutation.mutate(vars);
    },
    [isSubmitting, mutation]
  );

  const mutateAsync = useCallback(
    async (vars: TVars) => {
      if (isSubmitting || mutation.isPending) {
        throw new Error('A mutation is already in progress.');
      }
      return mutation.mutateAsync(vars);
    },
    [isSubmitting, mutation]
  );

  return {
    ...mutation,
    mutate,
    mutateAsync,
    isPending: mutation.isPending || isSubmitting,
    isSubmitting: mutation.isPending || isSubmitting,
  };
}
