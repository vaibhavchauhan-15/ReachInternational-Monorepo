/**
 * ReachInternational Mobile — Motion & Transitions Lab
 * Interactive diagnostic and tuning suite for Android 16 / Material 3 Expressive motion primitives.
 * Tests:
 * - Physics-based Bottom Sheet (drag, snap, flick-to-dismiss, rubber-band, insets)
 * - Centered Dialog (scale from 0.92, effects scrim)
 * - Anchored Popover (scaleY 0.8 -> 1, boundary auto-flip)
 * - Right Slide-in Drawer (drag to dismiss)
 * - Toast / Snackbar (slide up 16dp, swipe to dismiss)
 * - System Reduced Motion status & duration collapse
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MobileHeader,
  Text,
  useTheme,
  Button,
  Card,
  Badge,
  Pressable,
} from '../../components/ui';
import {
  Sheet,
  Dialog,
  Popover,
  Drawer,
  Toast,
} from '../../components/ui/overlay';
import { useMotion } from '../../lib/motion';
import {
  Sliders,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
  Menu,
  Icon,
} from '../../components/ui/icon';
import { postNotification } from '../../lib/notifications/postNotification';

export default function MotionLabScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { isReduced, SPATIAL, EFFECTS, DUR } = useMotion();

  // Overlay state triggers
  const [showSheet, setShowSheet] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Icon Behavior Diagnostic triggers
  const [iconToggle, setIconToggle] = useState(false);
  const [eyeState, setEyeState] = useState(false);
  const [ringCount, setRingCount] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [checkKey, setCheckKey] = useState(0);

  const popoverAnchorRef = useRef<View>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const openPopover = () => {
    if (popoverAnchorRef.current) {
      popoverAnchorRef.current.measureInWindow((x, y, width, height) => {
        setPopoverAnchor({ x, y, width, height });
        setShowPopover(true);
      });
    } else {
      setShowPopover(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Motion Lab"
        subtitle="Android 16 Expressive Tuning"
        showBack={true}
        backRoute="/dashboard"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* System Motion Status Card */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Sliders size={20} color={theme.colors.link} />
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              System Motion Status
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text variant="body" style={{ color: theme.colors.body }}>
              Reduced Motion:
            </Text>
            <Badge
              status={isReduced ? 'warning' : 'success'}
              customLabel={isReduced ? 'ACTIVE (0ms/Instant)' : 'OFF (Full Physics)'}
            />
          </View>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            All tokens automatically scale to duration 0 or opacity-only transitions when system animator scale is 0.
          </Text>
        </Card>

        {/* Primitive Interactive Triggers */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Layers size={20} color="#0284c7" />
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Overlay Primitives
            </Text>
          </View>

          <View style={styles.buttonList}>
            {/* Sheet Trigger */}
            <Button
              variant="secondary"
              label="Open Bottom Sheet (Gesture Pan)"
              onPress={() => setShowSheet(true)}
            />

            {/* Dialog Trigger */}
            <Button
              variant="secondary"
              label="Open Centered Dialog (Scale 0.92)"
              onPress={() => setShowDialog(true)}
            />

            {/* Popover Trigger */}
            <View ref={popoverAnchorRef} collapsable={false}>
              <Button
                variant="secondary"
                label="Open Anchored Popover"
                onPress={openPopover}
              />
            </View>

            {/* Drawer Trigger */}
            <Button
              variant="secondary"
              label="Open Right Drawer (Swipe Dismiss)"
              onPress={() => setShowDrawer(true)}
            />

            {/* Toast Trigger */}
            <Button
              variant="secondary"
              label="Trigger Ambient Toast Banner"
              onPress={() => {
                postNotification({
                  category: 'machine',
                  title: 'Equipment Telemetry Synced',
                  body: 'Scissor Lift M/C-0006 telemetry received via Supabase Realtime.',
                  severity: 'success',
                });
              }}
            />
          </View>
        </Card>

        {/* 3. MATERIAL 3 EXPRESSIVE ICON BEHAVIORS */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Sparkles size={20} color="#0284c7" />
            <Text variant="heading" style={{ color: theme.colors.ink }}>
              Icon Animation Behaviors
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            Tap each card to trigger real-time spring transforms on the UI thread.
          </Text>

          <View style={styles.iconGrid}>
            {/* rotateToggle */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setIconToggle((prev) => !prev)}
              style={styles.iconTestItem}
            >
              <View style={styles.iconPairRow}>
                <Icon name="chevron-down" size={20} state={iconToggle ? 'open' : 'closed'} color={theme.colors.ink} />
                <Icon name="plus" size={20} state={iconToggle ? 'open' : 'closed'} color={theme.colors.ink} degrees={45} />
              </View>
              <Text variant="caption" style={{ color: theme.colors.mute }}>rotateToggle</Text>
            </Pressable>

            {/* morphPair */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setEyeState((prev) => !prev)}
              style={styles.iconTestItem}
            >
              <View style={styles.iconPairRow}>
                <Icon name="menu" size={20} state={eyeState ? 'open' : 'closed'} color={theme.colors.ink} />
                <Icon name="eye" size={20} state={eyeState ? 'off' : 'on'} color={theme.colors.ink} />
              </View>
              <Text variant="caption" style={{ color: theme.colors.mute }}>morphPair</Text>
            </Pressable>

            {/* drawStroke */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setCheckKey((k) => k + 1)}
              style={styles.iconTestItem}
            >
              <View style={styles.iconPairRow}>
                <Icon key={`chk-${checkKey}`} name="check" size={20} animate="mount" color="#10b981" />
                <Icon key={`chkc-${checkKey}`} name="check-circle" size={20} animate="mount" color="#10b981" />
              </View>
              <Text variant="caption" style={{ color: theme.colors.mute }}>drawStroke</Text>
            </Pressable>

            {/* ring */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setRingCount((c) => c + 1)}
              style={styles.iconTestItem}
            >
              <Icon name="bell" size={20} pulseKey={ringCount} color="#f59e0b" />
              <Text variant="caption" style={{ color: theme.colors.mute }}>ring (bell)</Text>
            </Pressable>

            {/* spin */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setIsSpinning((s) => !s)}
              style={styles.iconTestItem}
            >
              <Icon name="refresh-cw" size={20} loading={isSpinning} color="#0284c7" />
              <Text variant="caption" style={{ color: theme.colors.mute }}>{isSpinning ? 'spin (ON)' : 'spin (OFF)'}</Text>
            </Pressable>

            {/* pulse */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => setPulseCount((c) => c + 1)}
              style={styles.iconTestItem}
            >
              <Icon name="alert-triangle" size={20} pulseKey={pulseCount} color="#ef4444" />
              <Text variant="caption" style={{ color: theme.colors.mute }}>pulse</Text>
            </Pressable>

            {/* static icons */}
            <Pressable
              variant="card"
              haptic={false}
              onPress={() => {}}
              style={styles.iconTestItem}
            >
              <View style={styles.iconPairRow}>
                <Icon name="arrow-right" size={20} color={theme.colors.link} />
                <Icon name="search" size={20} color={theme.colors.link} />
              </View>
              <Text variant="caption" style={{ color: theme.colors.mute }}>icons</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>

      {/* 1. BOTTOM SHEET */}
      <Sheet visible={showSheet} onClose={() => setShowSheet(false)}>
        <View style={styles.sheetBody}>
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            Material 3 Expressive Sheet
          </Text>
          <Text variant="body" style={{ color: theme.colors.mute }}>
            Drag handle down or flick downwards to dismiss. Dragging upwards activates rubber-band resistance. Sits on UI thread.
          </Text>
          <Button variant="primary" label="Close Sheet" onPress={() => setShowSheet(false)} />
        </View>
      </Sheet>

      {/* 2. CENTERED DIALOG */}
      <Dialog visible={showDialog} onClose={() => setShowDialog(false)}>
        <View style={styles.dialogBody}>
          <ShieldCheck size={32} color="#0284c7" />
          <Text variant="heading" style={{ color: theme.colors.ink, textAlign: 'center' }}>
            Expressive Centered Dialog
          </Text>
          <Text variant="body" style={{ color: theme.colors.mute, textAlign: 'center' }}>
            Scaled from 0.92 to 1.0 using SPATIAL.default spring. Back button and backdrop dismiss with top priority.
          </Text>
          <Button variant="primary" label="Confirm & Dismiss" onPress={() => setShowDialog(false)} />
        </View>
      </Dialog>

      {/* 3. ANCHORED POPOVER */}
      <Popover visible={showPopover} onClose={() => setShowPopover(false)} anchor={popoverAnchor}>
        <View style={styles.popoverBody}>
          <Text variant="label" style={{ color: theme.colors.ink, padding: 8 }}>
            Dropdown Actions
          </Text>
          <Button variant="secondary" label="Action 1" onPress={() => setShowPopover(false)} />
          <Button variant="secondary" label="Action 2" onPress={() => setShowPopover(false)} />
        </View>
      </Popover>

      {/* 4. RIGHT DRAWER */}
      <Drawer visible={showDrawer} onClose={() => setShowDrawer(false)}>
        <View style={styles.drawerBody}>
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            Right Slide-in Drawer
          </Text>
          <Text variant="body" style={{ color: theme.colors.mute }}>
            Swipe right on this panel to dismiss. Driven by SPATIAL.default physics springs.
          </Text>
          <Button variant="primary" label="Close Drawer" onPress={() => setShowDrawer(false)} />
        </View>
      </Drawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonList: {
    gap: 10,
  },
  sheetBody: {
    padding: 20,
    gap: 16,
  },
  dialogBody: {
    alignItems: 'center',
    gap: 12,
  },
  popoverBody: {
    padding: 8,
    gap: 4,
  },
  drawerBody: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconTestItem: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  iconPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
