import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { haptics } from '../../lib/interaction/haptics';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Icon as CanonicalIcon } from '../ui/Icon';
import { Touchable } from '../ui/Touchable';
import { AppModal } from '../ui/AppModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Home,
  Wrench,
  Gauge,
  Users,
  Building2,
  Shield,
  Banknote,
  CalendarCheck,
  Activity,
  ChevronRight,
  X,
  LogOut,
  Settings,
  User,
  Info,
  Bell,
  FileText,
  Menu,
  type LucideIcon,
} from 'lucide-react-native';

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  banknote: Banknote,
  'calendar-check': CalendarCheck,
  activity: Activity,
  settings: Settings,
  user: User,
  info: Info,
  bell: Bell,
  'file-text': FileText,
  menu: Menu,
};

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  match?: readonly string[] | string[];
};

type Props = {
  items: MenuItem[];
  primaryItems?: MenuItem[];
  user: { name: string; email: string; initials: string };
  onClosed: () => void;
  onLogout: () => void;
};

export const MobileMenuDrawer: React.FC<Props> = ({
  items,
  primaryItems = [],
  user,
  onClosed,
  onLogout,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Exact web proportion: min(86vw, 320px)
  const panelWidth = Math.min(screenWidth * 0.86, 320);

  const [isVisible, setIsVisible] = useState(true);
  const isClosingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    haptics.select();
  }, []);

  const closeDrawer = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    // Matches the fast exit timing for AppModal before unmounting
    setTimeout(() => {
      onClosed();
    }, 200);
  }, [onClosed]);

  // Close on route change (but not on initial mount)
  const initialPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== initialPath.current) {
      closeDrawer();
    }
  }, [pathname, closeDrawer]);

  const handleLogout = () => {
    haptics.warning();
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await onLogout();
      setShowLogoutConfirm(false);
    } catch (err) {
      console.error('[MobileMenuDrawer] Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleNavigate = (rawHref: string) => {
    const targetHref = rawHref.startsWith('/(app)') ? rawHref : `/(app)${rawHref}`;
    closeDrawer();
    setTimeout(() => {
      router.push(targetHref as any);
    }, 60);
  };

  // Strictly filter out any items that are already in the bottom navbar
  const displayItems = useMemo(() => {
    const primaryKeySet = new Set(primaryItems.map((p) => p.key));
    return items.filter((item) => !primaryKeySet.has(item.key));
  }, [items, primaryItems]);

  const checkIsActive = (item: MenuItem) => {
    const normalize = (p: string) => p.replace(/^\/\(app\)/, '').replace(/\/$/, '') || '/';
    const current = normalize(pathname);
    const target = normalize(item.href);

    if (item.match && item.match.length > 0) {
      return item.match.some((prefix) => {
        const normPrefix = normalize(prefix);
        if (normPrefix === '/') return current === '/';
        return current.startsWith(normPrefix);
      });
    }

    if (target === '/' || target === '/dashboard') {
      return current === '/' || current === '/dashboard';
    }
    return current.startsWith(target);
  };

  // Horizontal swipe-right-to-dismiss gesture matching web mobile drawer
  const handleTouchStart = (e: GestureResponderEvent) => {
    touchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    };
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.nativeEvent.pageX - touchStartRef.current.x;
    const deltaY = e.nativeEvent.pageY - touchStartRef.current.y;
    // Direction locked: must be predominantly horizontal swipe to the right, >= 45px
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaX > 45) {
      closeDrawer();
    }
    touchStartRef.current = null;
  };

  return (
    <>
      <AppModal
        visible={isVisible}
        onClose={closeDrawer}
        variant="right"
      >
        <View
          style={[
            styles.panel,
            {
              width: panelWidth,
              backgroundColor: theme.colors.canvasElevated,
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header matching web drawer: Clean "Menu" + X close button */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <Text variant="heading" style={[styles.headerTitle, { color: theme.colors.ink }]}>
              Menu
            </Text>
            <Touchable
              preset="icon"
              haptic="light"
              onPress={closeDrawer}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close navigation menu"
            >
              <CanonicalIcon icon={X} size={22} color={theme.colors.ink} />
            </Touchable>
          </View>

          {/* Scrollable Navigation Body */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
          >
            {displayItems.map((item) => {
              const IconComponent = ICONS[item.icon] || Menu;
              const isActive = checkIsActive(item);

              return (
                <Touchable
                  key={item.key}
                  preset="card"
                  haptic="select"
                  style={[
                    styles.card,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? 'rgba(2, 132, 199, 0.16)'
                          : 'rgba(2, 132, 199, 0.08)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : '#ffffff',
                      borderColor: isActive
                        ? isDark
                          ? 'rgba(56, 189, 248, 0.4)'
                          : '#bae6fd'
                        : theme.colors.hairline,
                    },
                  ]}
                  onPress={() => handleNavigate(item.href)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={item.label}
                >
                  <CanonicalIcon
                    icon={IconComponent}
                    size={20}
                    color={isActive ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.mute}
                  />
                  <Text
                    variant="subheading"
                    style={[
                      styles.cardLabel,
                      {
                        color: isActive
                          ? isDark
                            ? '#38bdf8'
                            : '#0284c7'
                          : theme.colors.ink,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <CanonicalIcon
                    icon={ChevronRight}
                    size={16}
                    color={isActive ? (isDark ? '#38bdf8' : '#0284c7') : theme.colors.mute}
                  />
                </Touchable>
              );
            })}
          </ScrollView>

          {/* Pinned Footer with Profile Link & Sign Out */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Touchable
              preset="card"
              haptic="light"
              style={styles.profileArea}
              onPress={() => handleNavigate('/(app)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open user profile"
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.22)' : '#dbeafe',
                  },
                ]}
              >
                <Text
                  variant="label"
                  style={[
                    styles.avatarText,
                    {
                      color: isDark ? '#38bdf8' : '#0369a1',
                    },
                  ]}
                >
                  {user.initials}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text
                  variant="subheading"
                  style={[styles.userName, { color: theme.colors.ink }]}
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                <Text
                  variant="caption"
                  style={[styles.userEmail, { color: theme.colors.mute }]}
                  numberOfLines={1}
                >
                  {user.email || 'View Profile'}
                </Text>
              </View>
            </Touchable>

            <Touchable
              preset="icon"
              haptic="warning"
              style={[
                styles.logoutBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                },
              ]}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
            >
              <CanonicalIcon icon={LogOut} size={20} color={isDark ? '#f87171' : '#dc2626'} />
            </Touchable>
          </View>
        </View>
      </AppModal>

      <ConfirmDialog
        visible={showLogoutConfirm}
        onClose={() => {
          if (!isLoggingOut) setShowLogoutConfirm(false);
        }}
        onConfirm={handleConfirmLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of Reach International on this mobile device?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLoggingOut}
        icon={<CanonicalIcon icon={LogOut} size={22} color={theme.colors.error} />}
      />
    </>
  );
};

const styles = StyleSheet.create({
  panel: {
    height: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {},
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardLabel: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  profileArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 12,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {},
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  userName: {},
  userEmail: {
    marginTop: 2,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
});

