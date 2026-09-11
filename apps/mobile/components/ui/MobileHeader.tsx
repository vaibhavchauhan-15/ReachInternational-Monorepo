import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme } from './ThemeProvider';
import { Badge } from './Badge';
import {
  ChevronLeft,
  WifiOff,
  Search,
  MoreVertical,
  X,
  RefreshCw,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { ReachBrandEmblem } from '../branding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileCommandPalette } from '../navigation/MobileCommandPalette';

export interface HeaderActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  badge?: string | number;
}

export interface HeaderSearchConfig {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  isSearching?: boolean;
  autoFocus?: boolean;
}

export interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  showRoleBadge?: boolean;
  showLogo?: boolean;
  showQuickAccess?: boolean;
  onQuickAccessPress?: () => void;
  onPressBack?: () => void;
  rightAction?: React.ReactNode;

  // Unified Header Search & 3-Dot Menu Capabilities
  search?: HeaderSearchConfig;
  onSearchPress?: () => void;
  searchPlaceholder?: string;
  actions?: HeaderActionItem[];
}

/**
 * MobileHeader — Standardized Mobile App Header across all screens:
 * Layout: [Logo (ReachBrandEmblem)] + [Page Title] + [Quick Access (⌘K)] + [3-Dot Menu for other actions]
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  showRoleBadge = false,
  showLogo = true,
  showQuickAccess = true,
  onQuickAccessPress,
  onPressBack,
  rightAction,
  search,
  onSearchPress,
  searchPlaceholder,
  actions,
}) => {
  const { role } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const { isOffline } = useNetworkStatus();
  const router = useRouter();

  // Responsive Screen Width Tracking
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return Dimensions.get('window').width;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  const isWide = screenWidth >= 640;

  // Mac keyboard shortcut detection
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
    }
  }, []);

  // Search State & Focus Tracking
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Quick Access Command Palette State
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  // Global ⌘K / Ctrl+K keyboard shortcut listener on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3-Dot Actions Menu State & Positioning
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<View>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; right: number }>({
    top: 50,
    right: 16,
  });

  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Graceful fallback
  }

  const handleBackPress = onPressBack || (() => router.back());

  const topPadding =
    Platform.OS === 'web'
      ? spacingNumeric.sm
      : Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24);

  // Measure and Open 3-Dot Menu
  const openActionMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const windowWidth =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerWidth
        : Dimensions.get('window').width;

    if (Platform.OS === 'web' && menuTriggerRef.current && (menuTriggerRef.current as any).getBoundingClientRect) {
      const rect = (menuTriggerRef.current as any).getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 6,
        right: Math.max(12, windowWidth - rect.right),
      });
      setMenuOpen(true);
      return;
    }

    if (menuTriggerRef.current) {
      menuTriggerRef.current.measureInWindow((x, y, width, height) => {
        setMenuCoords({
          top: y + height + 6,
          right: Math.max(12, windowWidth - (x + width)),
        });
        setMenuOpen(true);
      });
    } else {
      setMenuCoords({ top: 56, right: 16 });
      setMenuOpen(true);
    }
  };

  // Close 3-Dot Menu on Escape on Web
  useEffect(() => {
    if (!menuOpen || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Handle Quick Access Trigger Press
  const handleQuickAccessPress = () => {
    if (onQuickAccessPress) {
      onQuickAccessPress();
      return;
    }
    setIsCmdOpen(true);
  };

  // Default actions list if none provided
  const menuActions = useMemo<HeaderActionItem[]>(() => {
    if (actions && actions.length > 0) return actions;
    return [
      {
        id: 'theme-toggle',
        label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        icon: isDark ? <Sun size={15} color={theme.colors.ink} /> : <Moon size={15} color={theme.colors.ink} />,
        onPress: () => setMode(isDark ? 'light' : 'dark'),
      },
      {
        id: 'command-palette',
        label: 'Global Quick Access Palette',
        icon: <Search size={15} color={theme.colors.ink} />,
        onPress: () => handleQuickAccessPress(),
      },
    ];
  }, [actions, isDark, theme.colors.ink, setMode]);

  // Handle Search Trigger Click (when clicked on compact or fallback trigger)
  const handleSearchTriggerClick = () => {
    if (search) {
      setIsMobileSearchExpanded(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return;
    }
    if (onSearchPress) {
      onSearchPress();
      return;
    }
    handleQuickAccessPress();
  };

  const activePlaceholder =
    search?.placeholder || searchPlaceholder || 'Search...';

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.colors.canvas,
          borderBottomColor: theme.colors.hairline,
          paddingTop: topPadding,
        },
      ]}
    >
      {/* If Mobile Search is expanded full-width on small screens */}
      {!isWide && isMobileSearchExpanded && search ? (
        <View style={styles.expandedSearchRow}>
          <TouchableOpacity
            onPress={() => {
              setIsMobileSearchExpanded(false);
              search.onClear?.();
            }}
            activeOpacity={0.7}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityLabel="Close Search"
          >
            <ArrowLeft size={17} color={theme.colors.ink} />
          </TouchableOpacity>

          <View
            style={[
              styles.searchCapsule,
              styles.expandedSearchCapsule,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: isSearchFocused ? theme.colors.ink : theme.colors.hairline,
              },
              Platform.OS === 'web' && isSearchFocused
                ? ({ boxShadow: `0 0 0 1px ${theme.colors.ink}` } as any)
                : undefined,
            ]}
          >
            {search.isSearching ? (
              <ActivityIndicator size="small" color={theme.colors.link} style={{ width: 14, height: 14 }} />
            ) : (
              <Search size={14} color={isSearchFocused ? theme.colors.ink : theme.colors.mute} />
            )}

            <TextInput
              ref={searchInputRef}
              value={search.value}
              onChangeText={search.onChangeText}
              placeholder={activePlaceholder}
              placeholderTextColor={theme.colors.mute}
              style={[
                styles.searchInput,
                { color: theme.colors.ink },
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
              ]}
              autoFocus
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />

            {search.value.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  search.onClear ? search.onClear() : search.onChangeText('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear Search"
              >
                <X size={13} color={theme.colors.mute} />
              </TouchableOpacity>
            )}
          </View>

          {/* 3-Dot Menu Button during expanded search */}
          <View ref={menuTriggerRef} collapsable={false}>
            <TouchableOpacity
              onPress={openActionMenu}
              activeOpacity={0.7}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: menuOpen ? theme.colors.hairline : theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Other Actions"
            >
              <MoreVertical size={18} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Standard Header Row: [Logo] + [Page Title] + [Search] + [3-Dot Menu] */
        <View style={styles.contentRow}>
          {/* Left: Back Button + Logo + Title */}
          <View style={styles.leftSection}>
            {showBack && (
              <TouchableOpacity
                onPress={handleBackPress}
                activeOpacity={0.7}
                style={[
                  styles.backBtn,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Go Back"
              >
                <ChevronLeft size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            )}

            <View style={styles.titleWithLogoRow}>
              {showLogo && (
                <TouchableOpacity
                  onPress={() => router.push('/(app)/machines')}
                  activeOpacity={0.8}
                  style={styles.brandLogoTouch}
                  accessibilityLabel="Reach International"
                >
                  <ReachBrandEmblem size={24} />
                </TouchableOpacity>
              )}

              <View style={styles.titleTextContainer}>
                {title && (
                  <Text
                    style={[styles.titleText, { color: theme.colors.ink }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Center / Right: Search & Actions */}
          <View style={styles.rightSection}>
            {/* Offline Indicator Pill */}
            {isOffline && (
              <View
                style={[
                  styles.offlinePill,
                  {
                    backgroundColor: isDark ? '#451a03' : '#fffbeb',
                    borderColor: isDark ? '#78350f' : '#fef3c7',
                  },
                ]}
              >
                <WifiOff size={11} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text
                  style={[
                    styles.offlinePillText,
                    { color: isDark ? '#fbbf24' : '#b45309' },
                  ]}
                >
                  Offline
                </Text>
              </View>
            )}

            {/* Role Badge (optional) */}
            {showRoleBadge && (
              <Badge status="active" customLabel={(role || 'Operator').replace('_', ' ')} />
            )}

            {/* Custom Right Action (backward compatibility) */}
            {rightAction}

            {/* QUICK ACCESS SEARCH TRIGGER / SEARCH COMPONENT */}
            {search ? (
              isWide ? (
                /* Wide Viewport: Always visible Search Capsule in Header */
                <View
                  style={[
                    styles.searchCapsule,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: isSearchFocused ? theme.colors.ink : theme.colors.hairline,
                    },
                    Platform.OS === 'web' && isSearchFocused
                      ? ({ boxShadow: `0 0 0 1px ${theme.colors.ink}` } as any)
                      : undefined,
                  ]}
                >
                  {search.isSearching ? (
                    <ActivityIndicator size="small" color={theme.colors.link} style={{ width: 14, height: 14 }} />
                  ) : (
                    <Search size={14} color={isSearchFocused ? theme.colors.ink : theme.colors.mute} />
                  )}

                  <TextInput
                    ref={searchInputRef}
                    value={search.value}
                    onChangeText={search.onChangeText}
                    placeholder={activePlaceholder}
                    placeholderTextColor={theme.colors.mute}
                    style={[
                      styles.searchInput,
                      { color: theme.colors.ink },
                      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                    ]}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                  />

                  {search.value.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        search.onClear ? search.onClear() : search.onChangeText('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Clear Search"
                    >
                      <X size={13} color={theme.colors.mute} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* Compact Phone Viewport: Sleek Search Icon Button */
                <TouchableOpacity
                  onPress={handleSearchTriggerClick}
                  activeOpacity={0.7}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Search"
                >
                  <Search size={16} color={theme.colors.ink} />
                </TouchableOpacity>
              )
            ) : showQuickAccess ? (
              isWide ? (
                /* Wide Viewport (Desktop / Tablet): Pill Capsule with Quick Access label & ⌘K / Ctrl K pill */
                <TouchableOpacity
                  onPress={handleQuickAccessPress}
                  activeOpacity={0.75}
                  style={[
                    styles.quickAccessCapsule,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Quick Access (⌘K)"
                >
                  <Search size={14} color={theme.colors.mute} />
                  <Text style={[styles.quickAccessText, { color: theme.colors.mute }]}>
                    Quick Access
                  </Text>
                  <View
                    style={[
                      styles.quickAccessKbd,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.quickAccessKbdText, { color: theme.colors.mute }]}>
                      {isMac ? '⌘K' : 'Ctrl K'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                /* Compact Phone Viewport: Sleek 36×36 Quick Access Icon Button */
                <TouchableOpacity
                  onPress={handleQuickAccessPress}
                  activeOpacity={0.7}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Quick Access"
                >
                  <Search size={16} color={theme.colors.ink} />
                </TouchableOpacity>
              )
            ) : null}

            {/* 3-DOT MENU BUTTON FOR OTHER ACTIONS */}
            <View ref={menuTriggerRef} collapsable={false}>
              <TouchableOpacity
                onPress={openActionMenu}
                activeOpacity={0.7}
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: menuOpen ? theme.colors.hairline : theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Other Actions"
              >
                <MoreVertical size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ANCHORED 3-DOT ACTION MENU MODAL */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.menuCard,
                  {
                    top: menuCoords.top,
                    right: menuCoords.right,
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.menuHeader}>
                  <Text style={[styles.menuHeaderText, { color: theme.colors.mute }]}>
                    ACTIONS
                  </Text>
                </View>

                {menuActions.map((action, idx) => (
                  <TouchableOpacity
                    key={action.id || idx}
                    disabled={action.disabled}
                    onPress={() => {
                      setMenuOpen(false);
                      action.onPress();
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.menuItem,
                      idx < menuActions.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.hairline,
                      },
                      action.disabled && { opacity: 0.4 },
                    ]}
                  >
                    {action.icon && (
                      <View style={styles.menuItemIcon}>
                        {action.icon}
                      </View>
                    )}

                    <Text
                      style={[
                        styles.menuItemLabel,
                        {
                          color: action.destructive ? '#ef4444' : theme.colors.ink,
                          fontWeight: action.destructive ? '700' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>

                    {action.badge !== undefined && (
                      <View style={[styles.menuItemBadge, { backgroundColor: theme.colors.hairline }]}>
                        <Text style={[styles.menuItemBadgeText, { color: theme.colors.body }]}>
                          {action.badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Integrated Global Command Palette (when search is clicked without direct query) */}
      <MobileCommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        userRole={role || 'operator'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 40,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
    gap: 8,
  },
  expandedSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    gap: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWithLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  brandLogoTouch: {
    flexShrink: 0,
  },
  titleTextContainer: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  searchCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    width: 200,
    maxWidth: 280,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  expandedSearchCapsule: {
    flex: 1,
    maxWidth: undefined,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    padding: 0,
    margin: 0,
  },
  searchPlaceholderText: {
    fontSize: 12.5,
    flex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickAccessCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  quickAccessText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  quickAccessKbd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  quickAccessKbdText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  offlinePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  menuCard: {
    position: 'absolute',
    minWidth: 220,
    maxWidth: 290,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    fontSize: 13,
    flex: 1,
  },
  menuItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
  },
  menuItemBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
