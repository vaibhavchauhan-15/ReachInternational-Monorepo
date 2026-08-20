/**
 * ServiceCentric Mobile — Main Navigation Menu Modal
 * Displays all main pages in the application when the 3-line hamburger menu is tapped.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';
import {
  LayoutDashboard,
  CheckSquare,
  Truck,
  AlertTriangle,
  FileText,
  Sliders,
  Package,
  Key,
  TrendingUp,
  Receipt,
  Users,
  Bell,
  User,
  X,
  ChevronRight,
  Menu,
} from 'lucide-react-native';

export interface MainMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

export interface MenuItemDef {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: React.ElementType;
}

export interface MenuSectionDef {
  category: string;
  items: MenuItemDef[];
}

const MENU_SECTIONS: MenuSectionDef[] = [
  {
    category: 'CORE OPERATIONS',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Executive overview & KPIs',
        route: '/(app)/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'my-work',
        title: 'My Work',
        subtitle: 'Central field task queue',
        route: '/(app)/my-work',
        icon: CheckSquare,
      },
      {
        id: 'tasks',
        title: 'To-Do / Tasks',
        subtitle: 'Daily task list & assignments',
        route: '/(app)/tasks',
        icon: CheckSquare,
      },
      {
        id: 'machines',
        title: 'Machines Fleet',
        subtitle: 'Directory & service history',
        route: '/(app)/machines',
        icon: Truck,
      },
      {
        id: 'complaints',
        title: 'Breakdown Complaints',
        subtitle: 'Log & manage equipment issues',
        route: '/(app)/complaints',
        icon: AlertTriangle,
      },
      {
        id: 'fsr',
        title: 'Field Service Reports',
        subtitle: 'Digital FSRs & sign-offs',
        route: '/(app)/fsr',
        icon: FileText,
      },
      {
        id: 'operations',
        title: 'Operations Hub',
        subtitle: 'Shift logs, roster & transport',
        route: '/(app)/operations',
        icon: Sliders,
      },
    ],
  },
  {
    category: 'RESOURCE & COMMERCIAL',
    items: [
      {
        id: 'inventory',
        title: 'Inventory & Store',
        subtitle: 'Stock directory & requisitions',
        route: '/(app)/inventory',
        icon: Package,
      },
      {
        id: 'rentals',
        title: 'Rentals Suite',
        subtitle: 'Agreements, returns & clients',
        route: '/(app)/rentals',
        icon: Key,
      },
      {
        id: 'crm',
        title: 'CRM & Sales',
        subtitle: 'Leads, pipeline & logs',
        route: '/(app)/crm',
        icon: TrendingUp,
      },
    ],
  },
  {
    category: 'ADMINISTRATION & STAFF',
    items: [
      {
        id: 'finance',
        title: 'Finance & Accounting',
        subtitle: 'Expenses & tax invoices',
        route: '/(app)/finance',
        icon: Receipt,
      },
      {
        id: 'hr',
        title: 'HR & Directory',
        subtitle: 'Staff directory & requests',
        route: '/(app)/hr',
        icon: Users,
      },
      {
        id: 'notifications',
        title: 'Alerts & Notifications',
        subtitle: 'Realtime alerts & feed',
        route: '/(app)/notifications',
        icon: Bell,
      },
      {
        id: 'profile',
        title: 'Profile & Settings',
        subtitle: 'Account details & security',
        route: '/(app)/profile',
        icon: User,
      },
    ],
  },
];

export const MainMenuModal: React.FC<MainMenuModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
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
                <Menu size={16} color={theme.colors.canvas} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.colors.ink }]}>
                  Main Menu Navigation
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.colors.mute }]}>
                  Select a module to view its pages & submenus
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              activeOpacity={0.7}
            >
              <X size={18} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Menu Sections List */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {MENU_SECTIONS.map((section) => (
              <View key={section.category} style={styles.sectionContainer}>
                <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>
                  {section.category}
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
                  {section.items.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = pathname.includes(item.id);
                    const isLast = index === section.items.length - 1;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleNavigate(item.route)}
                        activeOpacity={0.7}
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
                            <IconComponent
                              size={18}
                              color={isActive ? theme.colors.onPrimary : theme.colors.ink}
                            />
                          </View>

                          <View>
                            <View style={styles.itemTitleRow}>
                              <Text
                                style={[
                                  styles.itemTitle,
                                  {
                                    color: isActive
                                      ? theme.colors.link
                                      : theme.colors.ink,
                                    fontWeight: isActive ? '800' : '600',
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
                                  <Text style={styles.activePillText}>ACTIVE</Text>
                                </View>
                              )}
                            </View>

                            <Text
                              style={[
                                styles.itemSubtitle,
                                { color: theme.colors.mute },
                              ]}
                            >
                              {item.subtitle}
                            </Text>
                          </View>
                        </View>

                        <ChevronRight
                          size={16}
                          color={isActive ? theme.colors.link : theme.colors.mute}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
  itemTitle: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
