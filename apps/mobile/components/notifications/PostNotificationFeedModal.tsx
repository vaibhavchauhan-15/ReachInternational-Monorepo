/**
 * ReachInternational Mobile — Post Notification Feed Modal
 * Allows users to view, filter, and clear recent operational notifications
 * across Machine, User, Log Entry, Log Manage, and Profile categories.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { haptics } from '../../lib/haptics';
import {
  getRecentNotificationFeed,
  clearNotificationFeed,
  PostNotificationPayload,
  NotificationCategory,
} from '../../lib/notifications';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Bell,
  Truck,
  Users,
  Clock,
  FileText,
  UserCheck,
  X,
  Trash2,
  AlertTriangle,
} from '../ui/icon';

export interface PostNotificationFeedModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PostNotificationFeedModal: React.FC<PostNotificationFeedModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const [feed, setFeed] = useState<PostNotificationPayload[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | NotificationCategory>('all');

  const loadFeed = useCallback(async () => {
    const items = await getRecentNotificationFeed();
    setFeed(items);
  }, []);

  useEffect(() => {
    if (visible) {
      loadFeed();
    }
  }, [visible, loadFeed]);

  const handleClear = async () => {
    await clearNotificationFeed();
    setFeed([]);
  };

  const filteredFeed = feed.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.category === selectedFilter;
  });

  const renderItemIcon = (category: NotificationCategory, severity?: string) => {
    const size = 15;
    if (severity === 'error') {
      return <AlertTriangle size={size} color="#ef4444" />;
    }
    switch (category) {
      case 'machine':
        return <Truck size={size} color={isDark ? '#38bdf8' : '#0284c7'} />;
      case 'user':
        return <Users size={size} color={isDark ? '#a78bfa' : '#7c3aed'} />;
      case 'log_entry':
        return <Clock size={size} color={isDark ? '#34d399' : '#059669'} />;
      case 'log_manage':
        return <FileText size={size} color={isDark ? '#fbbf24' : '#d97706'} />;
      case 'profile':
        return <UserCheck size={size} color={theme.colors.link} />;
      default:
        return <Bell size={size} color={theme.colors.link} />;
    }
  };

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Recent';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (!visible) return null;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      testID="post-notification-feed-modal"
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
          {/* Grab Handle */}
          <View style={[styles.handleBar, { backgroundColor: theme.colors.mute }]} />

          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerTitleCol}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Operational Notifications Feed
              </Text>
              <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
                Recent fleet, personnel, shift, and profile events
              </Text>
            </View>

            <View style={styles.headerActions}>
              {feed.length > 0 && (
                <Touchable
                  preset="button"
                  onPress={() => {
                    haptics.warning();
                    handleClear();
                  }}
                  style={[
                    styles.clearBtn,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2',
                    },
                  ]}
                  accessibilityLabel="Clear notification feed"
                >
                  <Trash2 size={13} color="#ef4444" />
                  <Text variant="caption" style={{ color: '#ef4444' }}>Clear</Text>
                </Touchable>
              )}

              <Touchable
                preset="icon"
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDark ? '#262626' : '#f4f4f5',
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Close notification feed"
              >
                <X size={15} color={theme.colors.mute} />
              </Touchable>
            </View>
          </View>

          {/* Filter Chips Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {(['all', 'machine', 'user', 'log_entry', 'log_manage', 'profile'] as const).map((filter) => {
              const isSelected = selectedFilter === filter;
              const labels: Record<string, string> = {
                all: 'All Events',
                machine: 'Machines',
                user: 'Users',
                log_entry: 'Logs Entry',
                log_manage: 'Operations',
                profile: 'Profile',
              };

              return (
                <Touchable
                  preset="button"
                  key={filter}
                  onPress={() => {
                    haptics.select();
                    setSelectedFilter(filter);
                  }}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? theme.colors.ink : theme.colors.canvas,
                      borderColor: isSelected ? theme.colors.ink : theme.colors.hairline,
                    },
                  ]}
                >
                  <Text
                    variant="label"
                    style={{
                      color: isSelected ? theme.colors.canvas : theme.colors.body,
                    }}
                  >
                    {labels[filter]}
                  </Text>
                </Touchable>
              );
            })}
          </ScrollView>

          {/* Feed List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedScroll}
          >
            {filteredFeed.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View
                  style={[
                    styles.emptyIconBox,
                    {
                      backgroundColor: isDark ? '#262626' : '#f4f4f5',
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Bell size={24} color={theme.colors.mute} />
                </View>
                <Text variant="heading" style={{ color: theme.colors.ink }}>
                  No Notifications Yet
                </Text>
                <Text variant="caption" style={[styles.emptyDesc, { color: theme.colors.mute }]}>
                  Operational events regarding machinery, shifts, and staff will appear here.
                </Text>
              </View>
            ) : (
              filteredFeed.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.feedItem,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.itemIconWrap,
                      {
                        backgroundColor: isDark ? '#262626' : '#f4f4f5',
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    {renderItemIcon(item.category, item.severity)}
                  </View>

                  <View style={styles.itemContent}>
                    <View style={styles.itemHeaderLine}>
                      <Text variant="label" style={{ color: theme.colors.ink, flex: 1, marginRight: 6 }} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        {formatRelativeTime(item.timestamp)}
                      </Text>
                    </View>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      {item.body}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 20,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
    opacity: 0.4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitleCol: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  feedScroll: {
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 36,
    gap: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 10,
  },
  itemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    marginBottom: 4,
  },
  emptyDesc: {
    textAlign: 'center',
  },
});
