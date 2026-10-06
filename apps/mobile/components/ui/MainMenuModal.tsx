import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';
import { AppModal } from './AppModal';
import { Touchable } from './Touchable';
import { haptics } from '../../lib/interaction/haptics';
import { useAuth } from '../../lib/auth/useAuth';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Wrench,
  Gauge,
  Activity,
  Users,
  User,
  X,
  ChevronRight,
  Menu,
} from 'lucide-react-native';

export interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MainMenuModal: React.FC<MainMenuModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const normalizedRole = (role || '').toLowerCase();
  const canAccessUsers =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager' ||
    normalizedRole === 'hr' ||
    normalizedRole === 'supervisor';

  const canAccessRunningLogs =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager' ||
    normalizedRole === 'supervisor' ||
    normalizedRole === 'hr';

  const menuItems = [
    {
      id: 'machines',
      title: 'Machines Fleet',
      subtitle: 'Directory, HMR meter readings & machine specs',
      route: '/(app)/machines',
      icon: Wrench,
    },
    {
      id: 'operations',
      title: 'Operations (Today)',
      subtitle: 'Real-time shift monitor & operator shift assignments',
      route: '/(app)/operations',
      icon: Gauge,
    },
    ...(canAccessRunningLogs
      ? [
          {
            id: 'running-logs',
            title: 'Daily Running Logs',
            subtitle: 'Monthly machinery running hours, daily shifts & breakdowns',
            route: '/(app)/running-logs',
            icon: Activity,
          },
        ]
      : []),
    ...(canAccessUsers
      ? [
          {
            id: 'users',
            title: 'Employees & Users',
            subtitle: 'Account approvals, roles & employee directory',
            route: '/(app)/users',
            icon: Users,
          },
        ]
      : []),
    {
      id: 'profile',
      title: 'Profile & Settings',
      subtitle: 'User account, location details & appearance',
      route: '/(app)/profile',
      icon: User,
    },
  ];

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      testID="main-menu-modal"
    >
      <View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.iconBadge, { backgroundColor: theme.colors.ink }]}>
              <Icon name={Menu} variant="subheading" color={theme.colors.canvas} />
            </View>
            <View>
              <Text variant="heading" style={[styles.headerTitle, { color: theme.colors.ink }]}>
                Reach International
              </Text>
              <Text variant="caption" style={[styles.headerSubtitle, { color: theme.colors.mute }]}>
                Active Operations & Management Modules
              </Text>
            </View>
          </View>

          <Touchable
            preset="icon"
            onPress={onClose}
            style={[
              styles.closeBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Icon name={X} variant="subheading" color={theme.colors.ink} />
          </Touchable>
        </View>

        {/* Menu Sections List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionContainer}>
            <Text variant="caption" style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>
              CORE FLEET MODULES
            </Text>

            <View
              style={[
                styles.sectionBox,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                const isActive = pathname.includes(item.id);
                const isLast = index === menuItems.length - 1;

                return (
                  <Touchable
                    preset="row"
                    key={item.id}
                    onPress={() => {
                      haptics.select();
                      handleNavigate(item.route);
                    }}
                    style={[
                      styles.menuItemRow,
                      {
                        borderBottomColor: theme.colors.hairline,
                        borderBottomWidth: isLast ? 0 : 1,
                        backgroundColor: isActive
                          ? theme.colors.hairlineSoft
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.itemLeft}>
                      <View
                        style={[
                          styles.itemIconContainer,
                          {
                            backgroundColor: isActive
                              ? theme.colors.link
                              : theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <Icon
                          name={IconComponent}
                          variant="subheading"
                          color={isActive ? theme.colors.onPrimary : theme.colors.ink}
                        />
                      </View>

                      <View>
                        <View style={styles.itemTitleRow}>
                          <Text
                            variant="subheading"
                            style={[
                              styles.itemTitle,
                              {
                                color: isActive
                                  ? theme.colors.link
                                  : theme.colors.ink,
                              },
                            ]}
                          >
                            {item.title}
                          </Text>
                          {isActive && (
                            <View
                              style={[
                                styles.activePill,
                                { backgroundColor: theme.colors.link },
                              ]}
                            >
                              <Text variant="caption" style={styles.activePillText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>

                        <Text
                          variant="caption"
                          style={[
                            styles.itemSubtitle,
                            { color: theme.colors.mute },
                          ]}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>

                    <Icon
                      name={ChevronRight}
                      variant="caption"
                      color={isActive ? theme.colors.link : theme.colors.mute}
                    />
                  </Touchable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderTopWidth: 1,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {},
  headerSubtitle: {
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  sectionContainer: {
    gap: 6,
  },
  sectionEyebrow: {
    marginLeft: 4,
  },
  sectionBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {},
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    color: '#ffffff',
  },
  itemSubtitle: {
    marginTop: 2,
  },
});
