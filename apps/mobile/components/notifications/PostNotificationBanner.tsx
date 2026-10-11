/**
 * ReachInternational Mobile — Post Notification Bridge
 * Bridges background domain notifications (fleet assets, personnel, log exports)
 * directly into the canonical Geist Toast system (showToast / useToast).
 */

import React, { useEffect } from 'react';
import { subscribeToPostNotifications } from '../../lib/notifications';
import { showToast, type ToastType } from '../ui/overlay/Toast';

export const PostNotificationBanner: React.FC = () => {
  useEffect(() => {
    const unsubscribe = subscribeToPostNotifications((notification) => {
      const type: ToastType =
        notification.severity === 'error'
          ? 'error'
          : notification.severity === 'success'
          ? 'success'
          : notification.severity === 'warning'
          ? 'warning'
          : 'info';

      showToast(type, notification.title, notification.body);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return null;
};

export default PostNotificationBanner;
