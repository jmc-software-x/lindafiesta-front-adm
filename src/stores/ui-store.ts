import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type: NotificationType;
  durationMs: number;
  createdAt: number;
}

interface PushNotificationInput {
  title: string;
  message?: string;
  type?: NotificationType;
  durationMs?: number;
}

interface UiStore {
  notifications: AppNotification[];
  pushNotification: (notification: PushNotificationInput) => string;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

const MAX_NOTIFICATIONS = 5;

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useUiStore = create<UiStore>()((set) => ({
  notifications: [],
  pushNotification: ({ title, message, type = 'info', durationMs = 4000 }) => {
    const id = makeId();
    const notification: AppNotification = {
      id,
      title,
      message,
      type,
      durationMs,
      createdAt: Date.now(),
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
    }));

    return id;
  },
  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },
  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
