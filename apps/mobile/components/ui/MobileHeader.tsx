import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  StatusBar as RNStatusBar,
  Modal,
} from 'react-native';
import { haptics } from '../../lib/haptics';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme } from './ThemeProvider';
import { Badge } from './Badge';
import { Text, useTypeStyle } from './Text';
import { Touchable } from './Touchable';
import { Pressable } from './touch/Pressable';
import {
  ChevronLeft,
  Search,
  MoreVertical,
  X,
  RefreshCw,
  Sun,
  Moon,
  ArrowLeft,
} from './icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
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
  showQuickAccessCapsule?: boolean;
  showMoreMenu?: boolean;
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
  showLogo = false,
  showQuickAccess = true,
  showQuickAccessCapsule = false,
  showMoreMenu = true,
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
  const { pendingCount, syncingCount, failedCount, conflictCount, isSyncing } = useOfflineQueue();
  const router = useRouter();
  const searchTypeStyle = useTypeStyle('body');

  const totalQueued = pendingCount + syncingCount + failedCount + conflictCount;
  const isBannerVisible = isOffline || totalQueued > 0 || isSyncing;

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

  const handleBackPress =
    onPressBack ||
    (() => {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.replace('/dashboard');
      }
    });

  const androidStatusBar = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0;
  const safeTop = Math.max(insets.top, androidStatusBar, Platform.OS === 'ios' ? 44 : 0);

  const topPadding =
    Platform.OS === 'web'
      ? spacingNumeric.xs
      : isBannerVisible
      ? 6
      : safeTop + 5;

  const closeActionMenu = () => {
    setMenuOpen(false);
  };

  const handleActionPress = (action: HeaderActionItem) => {
    if (action.disabled) return;
    haptics.select();
    setMenuOpen(false);
    setTimeout(() => {
      action.onPress();
    }, 60);
  };

  // Measure and Open 3-Dot Menu
  const openActionMenu = () => {
    haptics.select();
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    const windowWidth =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.innerWidth
        : Dimensions.get('window').width;

    if (
      Platform.OS === 'web' &&
      menuTriggerRef.current &&
      typeof (menuTriggerRef.current as any).getBoundingClientRect === 'function'
    ) {
      const rect = (menuTriggerRef.current as any).getBoundingClientRect();
      setMenuCoords({
        top: Math.max(44, Math.round(rect.bottom + 6)),
        right: Math.max(12, Math.round(windowWidth - rect.right)),
      });
      setMenuOpen(true);
      return;
    }

    if (menuTriggerRef.current && typeof menuTriggerRef.current.measureInWindow === 'function') {
      menuTriggerRef.current.measureInWindow((x, y, width, height) => {
        setMenuCoords({
          top: Math.max(44, Math.round(y + height + 6)),
          right: Math.max(12, Math.round(windowWidth - (x + width))),
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
          <Pressable
            variant="plain"
            haptic={false}
            onPress={() => {
              setIsMobileSearchExpanded(false);
              search.onClear?.();
            }}
            hitSlopToMin48={true}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityLabel="Close Search"
          >
            <ArrowLeft size={16} color={theme.colors.ink} />
          </Pressable>

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
              <Search size={13} color={isSearchFocused ? theme.colors.ink : theme.colors.mute} />
            )}

            <TextInput
              ref={searchInputRef}
              value={search.value}
              onChangeText={search.onChangeText}
              placeholder={activePlaceholder}
              placeholderTextColor={theme.colors.mute}
              style={[
                styles.searchInput,
                searchTypeStyle,
                { color: theme.colors.ink },
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
              ]}
              autoFocus
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />

            {search.value.length > 0 && (
              <Pressable
                variant="plain"
                haptic={false}
                onPress={() => {
                  search.onClear ? search.onClear() : search.onChangeText('');
                }}
                hitSlopToMin48={true}
                accessibilityLabel="Clear Search"
              >
                <X size={12} color={theme.colors.mute} />
              </Pressable>
            )}
          </View>

          {/* 3-Dot Menu Button during expanded search */}
          <View ref={menuTriggerRef} collapsable={false}>
            <Pressable
              variant="plain"
              haptic={false}
              onPress={openActionMenu}
              hitSlopToMin48={true}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: menuOpen ? theme.colors.hairline : theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              accessibilityLabel="Other Actions"
            >
              <MoreVertical size={16} color={theme.colors.ink} />
            </Pressable>
          </View>
        </View>
      ) : (
        /* Standard Header Row: [Back Button] + [Clean Page Title] + [Search] + [3-Dot Menu] */
        <View style={styles.contentRow}>
          {/* Left: Back Button + Clean Page Title */}
          <View style={styles.leftSection}>
            {showBack && (
              <Pressable
                variant="plain"
                haptic={false}
                onPress={handleBackPress}
                hitSlopToMin48={true}
                style={[
                  styles.backBtn,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel="Go Back"
              >
                <ChevronLeft size={16} color={theme.colors.ink} />
              </Pressable>
            )}

            <View style={styles.titleTextContainer}>
              {eyebrow ? (
                <Text
                  variant="micro"
                  style={[styles.eyebrowText, { color: theme.colors.mute }]}
                  numberOfLines={1}
                >
                  {eyebrow}
                </Text>
              ) : null}
              {title && (
                <Text
                  variant="heading"
                  style={{ color: theme.colors.ink }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              )}
              {subtitle ? (
                <Text
                  variant="micro"
                  style={[styles.subtitleText, { color: theme.colors.mute }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Center / Right: Search & Actions */}
          <View style={styles.rightSection}>
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
                      searchTypeStyle,
                      { color: theme.colors.ink },
                      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
                    ]}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                  />

                  {search.value.length > 0 && (
                    <Pressable
                      variant="plain"
                      haptic={false}
                      onPress={() => {
                        search.onClear ? search.onClear() : search.onChangeText('');
                      }}
                      hitSlopToMin48={true}
                      accessibilityLabel="Clear Search"
                    >
                      <X size={12} color={theme.colors.mute} />
                    </Pressable>
                  )}
                </View>
              ) : (
                /* Compact Phone Viewport: Sleek Search Icon Button */
                <Pressable
                  variant="plain"
                  haptic={false}
                  onPress={handleSearchTriggerClick}
                  hitSlopToMin48={true}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Search"
                >
                  <Search size={15} color={theme.colors.ink} />
                </Pressable>
              )
            ) : showQuickAccess ? (
              isWide && showQuickAccessCapsule ? (
                /* Wide Viewport (Desktop / Tablet): Pill Capsule with Quick Access label & ⌘K / Ctrl K pill */
                <Touchable
                  preset="card"
                  onPress={handleQuickAccessPress}
                  hitSlopToMin48={true}
                  style={[
                    styles.quickAccessCapsule,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Quick Access (⌘K)"
                >
                  <Search size={13} color={theme.colors.mute} />
                  <Text variant="label" style={{ color: theme.colors.mute }}>
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
                    <Text variant="micro" style={{ color: theme.colors.mute }}>
                      {isMac ? '⌘K' : 'Ctrl K'}
                    </Text>
                  </View>
                </Touchable>
              ) : (
                /* Compact Phone Viewport / Dedicated Sleek 32×32 Quick Access Icon Button */
                <Pressable
                  variant="plain"
                  haptic={false}
                  onPress={handleQuickAccessPress}
                  hitSlopToMin48={true}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Quick Access"
                >
                  <Search size={15} color={theme.colors.ink} />
                </Pressable>
              )
            ) : null}

            {/* 3-DOT MENU BUTTON FOR OTHER ACTIONS */}
            {showMoreMenu !== false && (
              <View ref={menuTriggerRef} collapsable={false}>
                <Pressable
                  variant="plain"
                  haptic={false}
                  onPress={openActionMenu}
                  hitSlopToMin48={true}
                  style={[
                    styles.iconBtn,
                    {
                      backgroundColor: menuOpen ? theme.colors.hairline : theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Other Actions"
                >
                  <MoreVertical size={16} color={theme.colors.ink} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ANCHORED 3-DOT ACTION MENU (PORTALED VIA MODAL) */}
      <Modal
        visible={menuOpen}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={closeActionMenu}
      >
        {/* Fullscreen dismiss backdrop */}
        <Pressable
          variant="plain"
          onPress={closeActionMenu}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close action menu"
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              !isWide ? { backgroundColor: 'rgba(0, 0, 0, 0.45)' } : undefined,
            ]}
          />
        </Pressable>

        {isWide ? (
          /* Desktop & Tablet: Anchored Popover Box beneath 3-dot trigger */
          <View
            style={[
              styles.popoverMenu,
              {
                top: menuCoords.top,
                right: menuCoords.right,
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.menuHeader}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                ACTIONS
              </Text>
            </View>

            <ScrollView
              style={styles.menuScrollView}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {menuActions.map((action, idx) => (
                <Touchable
                  key={action.id || idx}
                  preset="row"
                  disabled={action.disabled}
                  onPress={() => handleActionPress(action)}
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
                    variant="label"
                    style={{
                      color: action.destructive ? '#ef4444' : theme.colors.ink,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>

                  {action.badge !== undefined && (
                    <View style={[styles.menuItemBadge, { backgroundColor: theme.colors.hairline }]}>
                      <Text variant="caption" style={{ color: theme.colors.body }}>
                        {action.badge}
                      </Text>
                    </View>
                  )}
                </Touchable>
              ))}
            </ScrollView>
          </View>
        ) : (
          /* Mobile (< 640px): Bottom Sheet Presentation */
          <View style={styles.mobileSheetWrapper} pointerEvents="box-none">
            <View
              style={[
                styles.mobileSheetPanel,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.handleWrapper}>
                <View
                  style={[
                    styles.dragHandle,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.24)'
                        : 'rgba(0, 0, 0, 0.18)',
                    },
                  ]}
                />
              </View>

              <View style={styles.menuHeader}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  ACTIONS
                </Text>
              </View>

              <ScrollView
                style={styles.menuScrollView}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                {menuActions.map((action, idx) => (
                  <Touchable
                    key={action.id || idx}
                    preset="row"
                    disabled={action.disabled}
                    onPress={() => handleActionPress(action)}
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
                      variant="label"
                      style={{
                        color: action.destructive ? '#ef4444' : theme.colors.ink,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {action.label}
                    </Text>

                    {action.badge !== undefined && (
                      <View style={[styles.menuItemBadge, { backgroundColor: theme.colors.hairline }]}>
                        <Text variant="caption" style={{ color: theme.colors.body }}>
                          {action.badge}
                        </Text>
                      </View>
                    )}
                  </Touchable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
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
    paddingBottom: 6,
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
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  subtitleText: {
    marginTop: 0,
  },
  eyebrowText: {
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  searchCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    width: 200,
    maxWidth: 280,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  expandedSearchCapsule: {
    flex: 1,
    maxWidth: undefined,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickAccessCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  quickAccessKbd: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  popoverMenu: {
    position: 'absolute',
    minWidth: 230,
    maxWidth: 290,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingVertical: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.26)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 20,
      },
    }),
  },
  mobileSheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  mobileSheetPanel: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.28)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.24,
        shadowRadius: 18,
        elevation: 20,
      },
    }),
  },
  handleWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: radiusNumeric.full,
  },
  menuScrollView: {
    maxHeight: 380,
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemIcon: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
  },
});
