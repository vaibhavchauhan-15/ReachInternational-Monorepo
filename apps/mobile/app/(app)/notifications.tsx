/**
 * ReachInternational Mobile — In-App Notifications Inbox Screen
 * Keyset-paginated infinite scroll, TanStack Query, offline resilience,
 * 100% design parity with Web, and zero raw typography properties.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { MobileHeader } from '../../components/ui/MobileHeader';
import { Text } from '../../components/ui/Text';
import { Pressable } from '../../components/ui/touch/Pressable';
import { Touchable } from '../../components/ui/Touchable';
import { useTheme } from '../../components/ui/ThemeProvider';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  FileText,
  ChevronRight,
  Check,
} from '../../components/ui/icon';
import {
  useNotificationsInfiniteList,
  useNotificationUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../lib/hooks/useNotificationsData';
import type { NotificationItem } from '@reachinternational/types';
import {
  formatNotificationTimeIST,
  getNotificationCategoryVisual,
  capNotificationCount,
} from '@reachinternational/utils';
import { resolveNotificationNav } from '@reachinternational/permissions';
import { haptics } from '../../lib/haptics';

function CategoryIcon({ category, isUnread }: { category: string; isUnread: boolean }) {
  const { theme } = useTheme();

  const renderIcon = () => {
    switch (category) {
      case 'breakdown':
      case 'maintenance':
        return <AlertTriangle size={15} color={theme.colors.warning} />;
      case 'shift_reminder':
        return <Clock size={15} color={theme.colors.link} />;
      case 'approvals':
      case 'approval':
        return <CheckCircle2 size={15} color={theme.colors.success} />;
      case 'security':
        return <ShieldAlert size={15} color={theme.colors.error} />;
      case 'payroll':
      case 'rfq':
        return <FileText size={15} color="#6366f1" />;
      case 'system':
      default:
        return <Bell size={15} color={theme.colors.mute} />;
    }
  };

  return (
    <View
      style={[
        styles.iconContainer,
        {
          backgroundColor: isUnread ? theme.colors.canvasElevated : theme.colors.canvas,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {renderIcon()}
      {isUnread && (
        <View
          style={[
            styles.unreadDot,
            {
              backgroundColor: theme.colors.link,
              borderColor: theme.colors.canvas,
            },
          ]}
        />
      )}
    </View>
  );
}

interface NotificationRowProps {
  item: NotificationItem;
  userRole?: string;
  onPress: (item: NotificationItem) => void;
}

const NotificationRow = React.memo(function NotificationRow({
  item,
  userRole,
  onPress,
}: NotificationRowProps) {
  const { theme } = useTheme();
  const isUnread = !item.read_at;
  const visual = getNotificationCategoryVisual(item.category);
  const timeFormatted = formatNotificationTimeIST(item.created_at);

  const nav = resolveNotificationNav(
    item.route_key,
    item.route_params,
    userRole
  );

  return (
    <Touchable
      preset="card"
      onPress={() => onPress(item)}
      hitSlopToMin48={true}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${timeFormatted}. ${isUnread ? 'Unread.' : 'Read.'}`}
      style={[
        styles.rowItem,
        {
          backgroundColor: isUnread
            ? theme.colors.canvasElevated
            : theme.colors.canvas,
          borderBottomColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Category Icon with Unread Dot */}
      <CategoryIcon category={item.category} isUnread={isUnread} />

      {/* Main Body */}
      <View style={styles.itemContent}>
        {/* Badges and Timestamp Row */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.categoryPill,
              {
                backgroundColor: isUnread
                  ? theme.colors.canvasElevated
                  : theme.colors.hairline,
              },
            ]}
          >
            <Text
              variant="micro"
              style={[
                styles.categoryText,
                { color: isUnread ? theme.colors.link : theme.colors.mute },
              ]}
              numberOfLines={1}
            >
              {visual.label}
            </Text>
          </View>

          {item.priority === 'critical' && (
            <View style={[styles.priorityPill, { backgroundColor: '#fee2e2' }]}>
              <Text variant="micro" style={[styles.priorityText, { color: '#b91c1c' }]}>
                Urgent
              </Text>
            </View>
          )}

          {item.priority === 'high' && (
            <View style={[styles.priorityPill, { backgroundColor: '#fef3c7' }]}>
              <Text variant="micro" style={[styles.priorityText, { color: '#b45309' }]}>
                Important
              </Text>
            </View>
          )}

          <View style={styles.timeSpacer}>
            <Text variant="micro" style={{ color: theme.colors.mute }}>
              {timeFormatted}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          variant={isUnread ? 'heading' : 'body'}
          style={[
            styles.titleText,
            { color: theme.colors.ink },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Body Text */}
        {Boolean(item.body) && (
          <Text
            variant="caption"
            style={[styles.bodyText, { color: theme.colors.mute }]}
            numberOfLines={2}
          >
            {item.body}
          </Text>
        )}
      </View>

      {/* Chevron indicator if navigation target exists */}
      {Boolean(nav.mobileRoute) && (
        <View style={styles.chevronContainer}>
          <ChevronRight size={14} color={theme.colors.mute} />
        </View>
      )}
    </Touchable>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfiniteList(filter);

  const { data: unreadCount = 0 } = useNotificationUnreadCount();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  // Flattened items from all keyset pages
  const items = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  const handleItemPress = useCallback(
    (item: NotificationItem) => {
      haptics.select();

      // Mark read if unread
      if (!item.read_at) {
        markReadMutation.mutate([item.id]);
      }

      // Navigate if route is authorized
      const nav = resolveNotificationNav(
        item.route_key,
        item.route_params,
        user?.role
      );

      if (nav.mobileRoute) {
        router.push(nav.mobileRoute as any);
      }
    },
    [markReadMutation, user?.role, router]
  );

  const handleMarkAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    haptics.select();
    markAllReadMutation.mutate();
  }, [unreadCount, markAllReadMutation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Header with Back button */}
      <MobileHeader
        title="Notifications"
        showBack={true}
        showMoreMenu={false}
      />

      {/* Filter Segmented Strip & Mark All Read Action */}
      <View
        style={[
          styles.filterStrip,
          {
            backgroundColor: theme.colors.canvas,
            borderBottomColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.pillContainer}>
          <Pressable
            variant="plain"
            haptic={false}
            onPress={() => {
              haptics.select();
              setFilter('all');
            }}
            hitSlopToMin48={true}
            style={[
              styles.filterPill,
              filter === 'all'
                ? [styles.activePill, { backgroundColor: theme.colors.ink }]
                : [styles.inactivePill, { borderColor: theme.colors.hairline }],
            ]}
          >
            <Text
              variant="label"
              style={{
                color: filter === 'all' ? theme.colors.canvas : theme.colors.mute,
              }}
            >
              All
            </Text>
          </Pressable>

          <Pressable
            variant="plain"
            haptic={false}
            onPress={() => {
              haptics.select();
              setFilter('unread');
            }}
            hitSlopToMin48={true}
            style={[
              styles.filterPill,
              filter === 'unread'
                ? [styles.activePill, { backgroundColor: theme.colors.ink }]
                : [styles.inactivePill, { borderColor: theme.colors.hairline }],
            ]}
          >
            <Text
              variant="label"
              style={{
                color: filter === 'unread' ? theme.colors.canvas : theme.colors.mute,
              }}
            >
              Unread
            </Text>
            {unreadCount > 0 && (
              <View
                style={[
                  styles.unreadCountBadge,
                  {
                    backgroundColor:
                      filter === 'unread' ? theme.colors.canvas : theme.colors.link,
                  },
                ]}
              >
                <Text
                  variant="micro"
                  style={{
                    color: filter === 'unread' ? theme.colors.ink : '#ffffff',
                  }}
                >
                  {capNotificationCount(unreadCount)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Mark All Read Action Button */}
        <Pressable
          variant="plain"
          haptic={false}
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
          hitSlopToMin48={true}
          style={[
            styles.markAllBtn,
            {
              opacity: unreadCount > 0 ? 1 : 0.4,
            },
          ]}
        >
          <Check size={13} color={theme.colors.link} />
          <Text variant="caption" style={[styles.markAllText, { color: theme.colors.link }]}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      {/* Main Content List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.skeletonCard,
                { borderBottomColor: theme.colors.hairline },
              ]}
            >
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={styles.skeletonLines}>
                <Skeleton width={80} height={12} borderRadius={4} />
                <Skeleton width="85%" height={16} borderRadius={4} />
                <Skeleton width="60%" height={12} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          error={error}
          title="Failed to Load Notifications"
          message={error?.message || 'Unable to connect to the notifications service.'}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            variant="empty"
            title={filter === 'unread' ? 'All caught up' : 'No notifications'}
            description={
              filter === 'unread'
                ? 'You have reviewed all your notifications.'
                : 'Alerts regarding your shifts, machines, and approvals will appear here.'
            }
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              userRole={user?.role}
              onPress={handleItemPress}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
              tintColor={theme.colors.link}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.paginationLoading}>
                <ActivityIndicator size="small" color={theme.colors.link} />
                <Text variant="micro" style={{ color: theme.colors.mute }}>
                  Loading older notifications...
                </Text>
              </View>
            ) : undefined
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
  },
  activePill: {},
  inactivePill: {
    borderWidth: 1,
  },
  unreadCountBadge: {
    paddingHorizontal: 5,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 8,
  },
  markAllText: {
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  itemContent: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  categoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    textTransform: 'uppercase',
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    textTransform: 'uppercase',
  },
  timeSpacer: {
    marginLeft: 'auto',
  },
  titleText: {},
  bodyText: {
    marginTop: 1,
  },
  chevronContainer: {
    alignSelf: 'center',
    paddingLeft: 4,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 60,
  },
  paginationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
});
