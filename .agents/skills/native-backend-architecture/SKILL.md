---
name: native-backend-architecture
description: Patterns, invariants, and best practices for native mobile backend and data architecture in apps/mobile (Expo SDK 57, React Native 0.86, TanStack Query, SecureStore, offline queue, touch ergonomics, and zero raw typography). Use whenever building or modifying native mobile data access, state management, or hardware integrations.
---

# Native Mobile Backend & Architecture Skill

> **Golden Rule**: While UI and visual design must achieve **100% parity** with Web, the native runtime data architecture must leverage native-first patterns for speed, offline reliability, and touch ergonomics.

---

## 1. When to Use This Skill

Activate this workflow whenever:
- Adding, refactoring, or querying server data in `apps/mobile`.
- Handling native authentication tokens or SecureStore access.
- Implementing offline queue mutations or network synchronization.
- Ensuring compliance with minimum 44px touch targets and haptic feedback.
- Enforcing `<Text variant="...">` and eliminating raw typography styles.

---

## 2. Core Architecture Invariants

| Component | Standard | Enforcement Rule |
| :--- | :--- | :--- |
| **Server State** | TanStack Query (`@tanstack/react-query`) | Centralized hooks in `lib/hooks/` and `lib/queries/`, 30s stale time, query key invalidation on mutations. |
| **Auth Storage** | `expo-secure-store` | Hardware-backed keystore (Android KeyStore / iOS Keychain). Never use unencrypted AsyncStorage for tokens. |
| **Offline Sync** | Offline Queue + NetInfo | Store offline mutations in `AsyncStorage`, show `OfflineBanner.tsx`, auto-sync when network reconnects. |
| **Touch Targets** | ≥ 44px hit areas | All touchable components must enforce `minHeight: 44` or appropriate `hitSlop`. |
| **Haptics** | `expo-haptics` | Trigger `Haptics.selectionAsync()` on tabs, toggles, submissions, and confirmations. |
| **Typography** | `<Text variant="...">` | Strict enforcement: **Zero raw typography properties** (`fontSize`, `fontWeight`, `lineHeight`) in `StyleSheet.create`. |

---

## 3. Implementation Patterns

### 3.1 Data Fetching with TanStack Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMachineLogs(machineId: string) {
  return useQuery({
    queryKey: ['machineLogs', machineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_machine_logs')
        .select('*')
        .eq('machine_id', machineId)
        .order('log_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

### 3.2 Mutation with Invalidation & Haptics

```typescript
import * as Haptics from 'expo-haptics';

export function useSubmitDailyLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: DailyLogPayload) => {
      const { data, error } = await supabase
        .from('daily_machine_logs')
        .insert(payload);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: ['machineLogs'] });
    },
  });
}
```

### 3.3 Pull-to-Refresh Implementation

```tsx
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor="#0284c7"
      colors={['#0284c7']}
    />
  }
>
  {/* Content */}
</ScrollView>
```

---

## 4. Verification Commands

Always run these checks before concluding a mobile task:

```bash
# 1. Typography Invariant (Must be 0 raw properties)
node scripts/check-typography.mjs

# 2. Native Mobile Test Suite (Must pass 21/21 scenarios)
node apps/mobile/run-tests.mjs

# 3. TypeScript Typecheck (Must pass with 0 errors)
pnpm --filter @reachinternational/mobile typecheck
```
