/**
 * ServiceCentric Mobile — Left Slide-Out Navigation Drawer
 * Displays role-based navigation menu and bottom profile card matching Web App sidebar.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Switch,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, Badge } from '../ui';
import { getVisibleMobileNavItems, type MobileNavItem } from '../../lib/nav/navItems';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';
import { X, ChevronDown, ChevronRight, LogOut, Sun, Moon, Shield, Settings, User as UserIcon } from 'lucide-react-native';

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const { user, role, signOut } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [expandedItem, setExpandedItem] = React.useState<string | null>(null);

  const visibleItems = getVisibleMobileNavItems(role || undefined);

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    router.replace('/(auth)/login');
  };

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  if (!isOpen) return null;

  return (
    <Modal transparent visible={isOpen} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop Tap dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Drawer Content */}
        <View style={[styles.drawerContent, { width: DRAWER_WIDTH, backgroundColor: theme.colors.canvas, borderRightColor: theme.colors.hairline }]}>
          {/* Top Brand Header */}
          <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.brandRow}>
              <View style={[styles.logoEmblem, { backgroundColor: theme.colors.ink }]}>
                <Text style={[styles.logoLetter, { color: theme.colors.canvas }]}>S</Text>
              </View>
              <View>
                <Text style={[styles.brandTitle, { color: theme.colors.ink }]}>ServiceCentric</Text>
                <Text style={[styles.brandSubtitle, { color: theme.colors.mute }]}>Reach International</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <X size={18} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Navigation List */}
          <ScrollView contentContainerStyle={styles.navScrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>CORE OPERATIONS</Text>

            {visibleItems.map((item) => {
              const IconComp = item.icon;
              const isActive = pathname.startsWith(item.href.replace('/(app)', ''));
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedItem === item.href;

              return (
                <View key={item.href} style={styles.itemWrapper}>
                  <TouchableOpacity
                    onPress={() => {
                      if (hasSubItems) {
                        setExpandedItem(isExpanded ? null : item.href);
                      }
                      handleNavigate(item.href);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.navItemBtn,
                      isActive && [styles.activeNavItemBtn, { backgroundColor: theme.colors.link + '1a', borderColor: theme.colors.link }],
                    ]}
                  >
                    <View style={styles.itemLeft}>
                      <IconComp size={18} color={isActive ? theme.colors.link : theme.colors.body} />
                      <Text
                        style={[
                          styles.itemLabel,
                          { color: isActive ? theme.colors.link : theme.colors.ink },
                          isActive && { fontWeight: '700' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>

                    {hasSubItems && (
                      <View style={styles.itemRight}>
                        {isExpanded ? (
                          <ChevronDown size={16} color={theme.colors.mute} />
                        ) : (
                          <ChevronRight size={16} color={theme.colors.mute} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom User Profile Card (Matching User Screenshot) */}
          <View style={[styles.drawerFooter, { borderTopColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated }]}>
            <View style={[styles.profileCard, { borderColor: theme.colors.hairline }]}>
              <View style={styles.profileHeaderRow}>
                <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                  <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                    {user?.email ? user.email[0].toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: theme.colors.ink }]} numberOfLines={1}>
                    {user?.email ? user.email.split('@')[0] : 'Super Admin'}
                  </Text>
                  <Text style={[styles.profileEmail, { color: theme.colors.mute }]} numberOfLines={1}>
                    {user?.email || 'admin@reachinternation.com'}
                  </Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <Badge status="active" customLabel={role || 'Admin'} />
                <View style={[styles.activeStatusPill, { backgroundColor: theme.colors.success + '22', borderColor: theme.colors.success }]}>
                  <View style={[styles.activeDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={[styles.activeText, { color: theme.colors.success }]}>Active</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Theme Selector Strip */}
              <View style={styles.themeRow}>
                <Text style={[styles.themeLabel, { color: theme.colors.body }]}>Theme</Text>
                <TouchableOpacity
                  onPress={toggleTheme}
                  activeOpacity={0.8}
                  style={[styles.themePill, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                >
                  {isDark ? (
                    <Moon size={14} color={theme.colors.warning} />
                  ) : (
                    <Sun size={14} color={theme.colors.warning} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.colors.hairline }]} />

              {/* Action Buttons */}
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                style={styles.signOutBtn}
              >
                <LogOut size={16} color={theme.colors.error} />
                <Text style={[styles.signOutText, { color: theme.colors.error }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    height: '100%',
    borderRightWidth: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 52,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoEmblem: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navScrollContent: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: spacingNumeric.sm,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginVertical: spacingNumeric.xs,
    paddingHorizontal: spacingNumeric.xs,
  },
  itemWrapper: {
    marginBottom: 2,
  },
  navItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: spacingNumeric.xs,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeNavItemBtn: {
    borderLeftWidth: 3,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerFooter: {
    padding: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  profileCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacingNumeric.xs,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 11,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacingNumeric.xs,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    gap: 4,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    marginVertical: spacingNumeric.xs,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  themePill: {
    padding: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
