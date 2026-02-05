import { useEffect, useState, useCallback } from 'react';

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if running in browser and Notification is available
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported || typeof window === 'undefined') {
      console.log('Browser does not support notifications');
      return false;
    }

    // If already granted, return true
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    // If denied, don't ask again
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return false;
    }

    // Request permission
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || typeof window === 'undefined') {
      console.log('Browser does not support notifications');
      return;
    }

    // Only send if permission is granted
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          ...options,
          badge: '/favicon.ico',
          requireInteraction: true,
        });
        console.log('Notification sent:', title);
      } catch (err) {
        console.error('Error sending notification:', err);
      }
    } else {
      console.log('Notification permission not granted. Current permission:', Notification.permission);
    }
  }, [isSupported]);

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported,
  };
}
