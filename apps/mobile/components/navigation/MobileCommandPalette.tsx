/**
 * ReachInternational Mobile — Mobile Command Palette
 * 100% Parity with Web CommandPalette (apps/web/components/ui/CommandPalette.tsx)
 * Provides instant search and 1-tap navigation to EVERY page, active module, and quick action.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Search,
  Wrench,
  Gauge,
  Clock,
  ClipboardList,
  Users,
  Building2,
  User,
  ChevronRight,
  X,
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
  Settings,
} from 'lucide-react-native';

export interface MobileCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Quick Actions' | 'System';
  icon: React.ComponentType<{ size?: number; color?: string }>;
  href?: string;
  action?: () => void;
  keywords?: string[];
  roles?: string[];
}

export const MobileCommandPalette: React.FC<MobileCommandPaletteProps> = ({
  isOpen,
  onClose,
  userRole = 'admin',
}) => {
  const { theme, isDark, setMode } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const handleNavigate = (href: string) => {
    onClose();
    setSearch('');
    router.push(href as any);
  };

  const handleSignOut = async () => {
    onClose();
    setSearch('');
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleToggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
    onClose();
  };

  const allItems: CommandItem[] = useMemo(() => {
    return [
      // NAVIGATION ITEMS (All Monorepo Domain Pages)
      {
        id: 'nav-machines',
        title: 'Machines Directory',
        subtitle: 'Fleet inventory, specs, HMR running hours & status tracking',
        category: 'Navigation',
        icon: Wrench,
        href: '/(app)/machines',
        keywords: ['equipment', 'devices', 'inventory', 'assets', 'fleet', 'scissor lift'],
        roles: ['super_admin', 'admin', 'manager', 'service_manager', 'supervisor', 'operator', 'mechanic', 'engineer', 'service_engineer'],
      },
      {
        id: 'nav-operations',
        title: 'Operations Hub',
        subtitle: 'Daily machine running logs, overtime & operator shift assignments',
        category: 'Navigation',
        icon: Gauge,
        href: '/(app)/operations',
        keywords: ['hours', 'duty', 'meter', 'shifts', 'assignments', 'logs', 'hmr'],
        roles: ['super_admin', 'admin', 'manager', 'service_manager', 'supervisor', 'operator'],
      },
      {
        id: 'nav-operations-running-hours',
        title: 'Daily Running Hours Logs',
        subtitle: 'View and export daily equipment meter logs and overtime disputes',
        category: 'Navigation',
        icon: Clock,
        href: '/(app)/operations?tab=logs',
        keywords: ['running hours', 'meter log', 'log history', 'daily log'],
        roles: ['super_admin', 'admin', 'manager', 'supervisor', 'service_manager', 'operator'],
      },
      {
        id: 'nav-operations-assignments',
        title: 'Operator Machine Assignments',
        subtitle: 'Manage 3-shift operator equipment rosters and capacity allocations',
        category: 'Navigation',
        icon: ClipboardList,
        href: '/(app)/operations?tab=assignments',
        keywords: ['assignments', 'shifts', 'roster', 'operator assignments'],
        roles: ['super_admin', 'admin', 'manager', 'supervisor', 'service_manager'],
      },
      {
        id: 'nav-clients',
        title: 'Clients & Accounts Directory',
        subtitle: 'Registered customer organizations, sites, billing & assigned equipment',
        category: 'Navigation',
        icon: Building2,
        href: '/(app)/clients',
        keywords: ['clients', 'customers', 'accounts', 'sites', 'locations'],
        roles: ['super_admin', 'admin', 'manager', 'service_manager'],
      },
      {
        id: 'nav-users',
        title: 'Employees & User Management',
        subtitle: 'Personnel directory, RBAC roles, KYC docs & account approvals',
        category: 'Navigation',
        icon: Users,
        href: '/(app)/users',
        keywords: ['users', 'employees', 'staff', 'operators', 'supervisors', 'mechanics', 'kyc', 'aadhaar'],
        roles: ['super_admin', 'admin', 'manager', 'service_manager', 'hr_manager'],
      },
      {
        id: 'nav-dashboard',
        title: 'Fleet Operations Dashboard',
        subtitle: 'Executive overview, fleet utilization KPIs & recent activities',
        category: 'Navigation',
        icon: LayoutDashboard,
        href: '/(app)/dashboard',
        keywords: ['dashboard', 'kpi', 'metrics', 'overview', 'analytics'],
      },
      {
        id: 'nav-my-work',
        title: 'My Work & Assigned Tasks',
        subtitle: 'Personal shift schedule, logged hours & assigned work orders',
        category: 'Navigation',
        icon: ClipboardList,
        href: '/(app)/my-work',
        keywords: ['my work', 'my tasks', 'my shifts', 'assigned'],
      },
      {
        id: 'nav-profile',
        title: 'User Profile & Identity',
        subtitle: 'View account credentials, contact info, shift timing & Aadhaar card',
        category: 'Navigation',
        icon: User,
        href: '/(app)/profile',
        keywords: ['profile', 'account', 'identity', 'phone', 'address'],
      },
      {
        id: 'nav-settings',
        title: 'Settings & Preferences',
        subtitle: 'Configure notifications, appearance theme, offline queue sync & password',
        category: 'Navigation',
        icon: Settings,
        href: '/(app)/settings',
        keywords: ['settings', 'preferences', 'theme', 'notifications', 'offline', 'sync', 'password', 'dark mode'],
      },

      // QUICK ACTIONS
      {
        id: 'action-add-machine',
        title: 'Add New Machine Asset',
        subtitle: 'Register industrial machine with serial number and initial HMR',
        category: 'Quick Actions',
        icon: Wrench,
        href: '/(app)/machines',
        keywords: ['add machine', 'create machine', 'new equipment'],
        roles: ['super_admin', 'admin', 'service_manager', 'manager'],
      },
      {
        id: 'action-assign-operator',
        title: 'Assign Operator to Machine',
        subtitle: 'Schedule field operator to equipment shift roster',
        category: 'Quick Actions',
        icon: ClipboardList,
        href: '/(app)/operations?tab=assignments',
        keywords: ['assign operator', 'assign machine', 'new assignment'],
        roles: ['super_admin', 'admin', 'service_manager', 'manager', 'supervisor'],
      },

      // SYSTEM & PREFERENCES
      {
        id: 'sys-theme',
        title: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: `Currently active: ${isDark ? 'Dark Mode (Canvas #0a0a0a)' : 'Light Mode (Canvas #fafafa)'}`,
        category: 'System',
        icon: isDark ? Sun : Moon,
        action: handleToggleTheme,
        keywords: ['theme', 'dark mode', 'light mode', 'appearance', 'color'],
      },
      {
        id: 'sys-logout',
        title: 'Sign Out of Account',
        subtitle: 'Securely terminate active session and return to login screen',
        category: 'System',
        icon: LogOut,
        action: handleSignOut,
        keywords: ['logout', 'sign out', 'exit', 'disconnect'],
      },
    ];
  }, [isDark]);

  // Filter items by user role and search query
  const filteredItems = useMemo(() => {
    const normalizedRole = (userRole || 'operator').toLowerCase();
    const query = search.trim().toLowerCase();

    return allItems.filter((item) => {
      // Role permission check
      if (item.roles && item.roles.length > 0) {
        const isPermitted =
          normalizedRole === 'super_admin' ||
          item.roles.some((r) => r.toLowerCase() === normalizedRole);
        if (!isPermitted) return false;
      }

      // Search query matching
      if (!query) return true;

      const titleMatch = item.title.toLowerCase().includes(query);
      const subtitleMatch = (item.subtitle || '').toLowerCase().includes(query);
      const categoryMatch = item.category.toLowerCase().includes(query);
      const keywordMatch = (item.keywords || []).some((kw) => kw.toLowerCase().includes(query));

      return titleMatch || subtitleMatch || categoryMatch || keywordMatch;
    });
  }, [allItems, userRole, search]);

  // Group filtered results by category
  const groupedItems = useMemo(() => {
    const categories: Record<string, CommandItem[]> = {
      Navigation: [],
      'Quick Actions': [],
      System: [],
    };

    filteredItems.forEach((item) => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });

    return categories;
  }, [filteredItems]);

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.paletteCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Top Notch Bar */}
          <View style={[styles.notchBar, { backgroundColor: theme.colors.mute }]} />

          {/* Search Header Bar */}
          <View
            style={[
              styles.searchBarContainer,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Search size={18} color={theme.colors.mute} />
            <TextInput
              style={[
                styles.searchInput,
                { color: theme.colors.ink },
              ]}
              placeholder="Search all pages, modules, commands..."
              placeholderTextColor={theme.colors.mute}
              value={search}
              onChangeText={setSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearBtn}
                activeOpacity={0.7}
              >
                <X size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
                  No results found
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
                  No pages or actions matched "{search}". Try another keyword.
                </Text>
              </View>
            ) : (
              Object.entries(groupedItems).map(([category, items]) => {
                if (items.length === 0) return null;

                return (
                  <View key={category} style={styles.categorySection}>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: theme.colors.mute },
                      ]}
                    >
                      {category.toUpperCase()}
                    </Text>

                    <View
                      style={[
                        styles.categoryCard,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      {items.map((item, idx) => {
                        const Icon = item.icon;
                        const isLast = idx === items.length - 1;

                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                              if (item.action) {
                                item.action();
                              } else if (item.href) {
                                handleNavigate(item.href);
                              }
                            }}
                            activeOpacity={0.7}
                            style={[
                              styles.itemRow,
                              !isLast && {
                                borderBottomColor: theme.colors.hairlineSoft,
                                borderBottomWidth: 1,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.iconContainer,
                                {
                                  backgroundColor: theme.colors.hairlineSoft,
                                  borderColor: theme.colors.hairline,
                                },
                              ]}
                            >
                              <Icon size={18} color={theme.colors.ink} />
                            </View>

                            <View style={styles.itemTextCol}>
                              <Text
                                style={[
                                  styles.itemTitle,
                                  { color: theme.colors.ink },
                                ]}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>
                              {item.subtitle && (
                                <Text
                                  style={[
                                    styles.itemSubtitle,
                                    { color: theme.colors.mute },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.subtitle}
                                </Text>
                              )}
                            </View>

                            <ChevronRight
                              size={16}
                              color={theme.colors.mute}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  paletteCard: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  notchBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 20,
    gap: spacingNumeric.md,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  categorySection: {
    gap: 6,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  categoryCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});
