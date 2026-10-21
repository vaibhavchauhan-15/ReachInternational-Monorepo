/**
 * ReachInternational Mobile — Mobile Command Palette
 * 100% Parity with Web CommandPalette & complete index of all native app destinations.
 * Provides instant debounced search, hierarchical breadcrumbs, RBAC enforcement,
 * and 1-tap direct navigation to every authorized page, nested settings screen,
 * operations tab, and actionable system function.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Icon as CanonicalIcon } from '../ui/icon';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { SearchInput } from '../ui/SearchInput';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/overlay';
import { haptics } from '../../lib/haptics';
import { useAuth } from '../../lib/auth/useAuth';
import { usePreferences } from '../../lib/preferences/store';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  ChevronRight,
  Search,
  X,
  LogOut,
} from '../ui/icon';
import {
  buildQuickAccessDestinations,
  filterAndScoreDestinations,
  type QuickAccessDestination,
  type QuickAccessCategory,
} from './quickAccessRegistry';

export interface MobileCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

const CATEGORY_ORDER: QuickAccessCategory[] = [
  'Navigation',
  'Settings',
  'Quick Actions',
  'System',
];

export const MobileCommandPalette: React.FC<MobileCommandPaletteProps> = ({
  isOpen,
  onClose,
  userRole = 'admin',
}) => {
  const { theme, isDark, setMode } = useTheme();
  const { signOut } = useAuth();
  const { hapticsEnabled, setHapticsEnabled } = usePreferences();
  const { toast } = useToast();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setDebouncedSearch('');
    }
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedIndex(0);
  };

  // Debounce search query with 50ms delay for lightning-fast responsive typing
  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 50);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedSearch]);

  // Reset search when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setDebouncedSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleNavigate = (href: string) => {
    onClose();
    setSearch('');
    setDebouncedSearch('');

    const [pathname, queryString] = href.split('?');
    if (queryString) {
      const params: Record<string, string> = {};
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
      router.push({
        pathname: pathname as any,
        params,
      });
    } else {
      router.push(href as any);
    }
  };

  const handleToggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setMode(nextMode);
    haptics.confirm();
    toast('info', nextMode === 'dark' ? 'Switched to Dark Theme' : 'Switched to Light Theme');
    onClose();
  };

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    if (next) haptics.confirm();
    toast('info', next ? 'Haptic feedback enabled' : 'Haptic feedback disabled');
    onClose();
  };

  const handleConfirmSignOut = async () => {
    try {
      setIsSigningOut(true);
      haptics.warning();
      await signOut();
      setShowSignOutConfirm(false);
      onClose();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('[MobileCommandPalette] Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleExecuteItem = (item: QuickAccessDestination) => {
    haptics.select();
    if (item.actionId === 'toggle-theme') {
      handleToggleTheme();
    } else if (item.actionId === 'toggle-haptics') {
      handleToggleHaptics();
    } else if (item.actionId === 'logout') {
      setShowSignOutConfirm(true);
    } else if (item.href) {
      handleNavigate(item.href);
    }
  };

  // Build all destinations dynamically based on state
  const allDestinations = useMemo(() => {
    return buildQuickAccessDestinations({
      userRole,
      isDark,
      hapticsEnabled,
    });
  }, [userRole, isDark, hapticsEnabled]);

  // Filter and score matching destinations
  const filteredItems = useMemo(() => {
    return filterAndScoreDestinations(allDestinations, debouncedSearch, userRole);
  }, [allDestinations, debouncedSearch, userRole]);

  // Group filtered results by category
  const groupedItems = useMemo(() => {
    const groups: Record<QuickAccessCategory, QuickAccessDestination[]> = {
      Navigation: [],
      Settings: [],
      'Quick Actions': [],
      System: [],
    };

    filteredItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    return groups;
  }, [filteredItems]);

  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 640;

  // Web keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleExecuteItem(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      <AppModal
        visible={isOpen}
        onClose={onClose}
        variant={isWide ? 'center' : 'bottom'}
        panelStyle={isWide ? styles.dialogPanelOverride : styles.sheetPanelOverride}
        testID="mobile-command-palette-modal"
      >
        <View style={styles.modalContent}>
          {/* Search Header Bar with Fast Touch-Friendly Close Button */}
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchInputBox}>
              <SearchInput
                value={search}
                onChangeText={handleSearchChange}
                onClear={handleClearSearch}
                placeholder="Search pages, settings, actions (e.g. theme, shift)..."
                autoFocus
                size="lg"
                name="cmd_search_query"
                id="cmd_search_query"
                autoComplete={Platform.OS === 'web' ? ('one-time-code' as any) : 'off'}
              />
            </View>
            <Touchable
              preset="icon"
              variant="iconButton"
              hitSlop={8}
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark ? '#262626' : '#f4f4f5',
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close quick access palette"
            >
              <X size={16} color={theme.colors.mute} />
            </Touchable>
          </View>

          {/* Results List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            style={styles.resultsScroll}
            contentContainerStyle={styles.scrollContent}
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <CanonicalIcon icon={Search} variant="subheading" color={theme.colors.mute} />
                </View>
                <Text variant="heading" style={[styles.emptyTitle, { color: theme.colors.ink }]}>
                  No matching destinations
                </Text>
                <Text variant="body" style={[styles.emptySubtitle, { color: theme.colors.mute }]}>
                  No authorized pages or actions matched "{debouncedSearch || search}". Try searching for machines, theme, shift entry, or password.
                </Text>
                <View style={styles.emptyActionRow}>
                  <Touchable
                    preset="card"
                    onPress={handleClearSearch}
                    style={[
                      styles.clearSearchBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <CanonicalIcon icon={X} variant="caption" color={theme.colors.ink} />
                    <Text variant="label" style={{ color: theme.colors.ink }}>
                      Clear Search
                    </Text>
                  </Touchable>
                </View>
              </View>
            ) : (
              CATEGORY_ORDER.map((category) => {
                const items = groupedItems[category];
                if (!items || items.length === 0) return null;

                return (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.categoryHeaderRow}>
                      <Text
                        variant="micro"
                        weight="bold"
                        style={[
                          styles.categoryLabel,
                          { color: theme.colors.mute },
                        ]}
                      >
                        {category.toUpperCase()}
                      </Text>
                      <Text
                        variant="micro"
                        style={[
                          styles.categoryCount,
                          { color: theme.colors.mute },
                        ]}
                      >
                        {items.length}
                      </Text>
                    </View>

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
                        const isSelected = filteredItems[selectedIndex]?.id === item.id;

                        return (
                          <Touchable
                            preset="row"
                            key={item.id}
                            onPress={() => handleExecuteItem(item)}
                            style={[
                              styles.itemRow,
                              isSelected && {
                                backgroundColor: theme.colors.hairlineSoft,
                              },
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
                                  backgroundColor: isSelected
                                    ? theme.colors.hairline
                                    : theme.colors.hairlineSoft,
                                  borderColor: theme.colors.hairline,
                                },
                              ]}
                            >
                              <CanonicalIcon
                                icon={Icon as any}
                                variant="subheading"
                                color={theme.colors.ink}
                              />
                            </View>

                            <View style={styles.itemTextCol}>
                              {item.breadcrumb ? (
                                <View style={styles.breadcrumbRow}>
                                  <Text
                                    variant="micro"
                                    style={[
                                      styles.breadcrumbText,
                                      { color: theme.colors.mute },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {item.breadcrumb}
                                  </Text>
                                </View>
                              ) : null}

                              <Text
                                variant="subheading"
                                style={[
                                  styles.itemTitle,
                                  { color: theme.colors.ink },
                                ]}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>

                              {item.subtitle ? (
                                <Text
                                  variant="caption"
                                  style={[
                                    styles.itemSubtitle,
                                    { color: theme.colors.mute },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.subtitle}
                                </Text>
                              ) : null}
                            </View>

                            <CanonicalIcon
                              icon={ChevronRight}
                              variant="caption"
                              color={theme.colors.mute}
                            />
                          </Touchable>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </AppModal>

      {/* Confirm Sign Out Dialog */}
      <ConfirmDialog
        visible={showSignOutConfirm}
        onClose={() => {
          if (!isSigningOut) setShowSignOutConfirm(false);
        }}
        onConfirm={handleConfirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of Reach International on this mobile device?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSigningOut}
        icon={<LogOut size={22} color={theme.colors.error} />}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sheetPanelOverride: {
    maxHeight: '92%',
    paddingBottom: 8,
  },
  dialogPanelOverride: {
    maxWidth: 580,
    maxHeight: 560,
    padding: 16,
    borderRadius: radiusNumeric.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 48px -12px rgba(0, 0, 0, 0.45)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.32,
        shadowRadius: 28,
        elevation: 24,
      },
    }),
  },
  modalContent: {
    width: '100%',
    flexShrink: 1,
    paddingBottom: 4,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacingNumeric.md,
    marginTop: 2,
    marginBottom: spacingNumeric.sm,
  },
  searchInputBox: {
    flex: 1,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultsScroll: {
    maxHeight: 480,
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 20,
    gap: spacingNumeric.md,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyActionRow: {
    marginTop: 8,
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    gap: 6,
  },
  categorySection: {
    gap: 6,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  categoryLabel: {
    marginLeft: 2,
  },
  categoryCount: {
    opacity: 0.7,
  },
  categoryCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    minHeight: 52,
    ...Platform.select({
      web: {
        transition: 'background-color 100ms ease',
      } as any,
    }),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    opacity: 0.85,
  },
  itemTitle: {},
  itemSubtitle: {},
});
