/**
 * ReachInternational Mobile — Canonical Reusable AppModal
 * Upgraded to delegate seamlessly to unified Android 16 Material 3 Expressive
 * overlay primitives (Sheet, Dialog, Drawer) while preserving backward-compatible props.
 */

import React, { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { Sheet } from './overlay/Sheet';
import { Dialog } from './overlay/Dialog';
import { Drawer } from './overlay/Drawer';

export type AppModalVariant = 'center' | 'bottom' | 'right' | 'fullscreen';

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  variant?: AppModalVariant;
  children: ReactNode;
  backdropColor?: string;
  style?: StyleProp<ViewStyle>;
  panelStyle?: StyleProp<ViewStyle>;
  persistent?: boolean;
  testID?: string;
  showHandle?: boolean;
}

export function AppModal({
  visible,
  onClose,
  variant = 'center',
  children,
  style,
  panelStyle,
  persistent = false,
  testID,
  showHandle,
}: AppModalProps) {
  if (variant === 'bottom') {
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        persistent={persistent}
        style={style}
        contentStyle={panelStyle}
        testID={testID}
        showHandle={showHandle}
      >
        {children}
      </Sheet>
    );
  }

  if (variant === 'right') {
    return (
      <Drawer
        visible={visible}
        onClose={onClose}
        persistent={persistent}
        style={style}
        contentStyle={panelStyle}
        testID={testID}
      >
        {children}
      </Drawer>
    );
  }

  // variant === 'center' or 'fullscreen'
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      persistent={persistent}
      style={style}
      contentStyle={[
        panelStyle,
        variant === 'fullscreen' && { width: '100%', height: '100%', maxWidth: '100%', borderRadius: 0 },
      ]}
      testID={testID}
    >
      {children}
    </Dialog>
  );
}
