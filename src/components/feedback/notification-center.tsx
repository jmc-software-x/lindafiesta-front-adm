'use client';

import { useEffect } from 'react';
import type { AppNotification } from '@/stores/ui-store';
import { useUiStore } from '@/stores/ui-store';

const toneClassMap: Record<AppNotification['type'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-white text-slate-900',
};

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      onDismiss(notification.id);
    }, notification.durationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [notification.durationMs, notification.id, onDismiss]);

  return (
    <article
      className={`w-full rounded-lg border px-4 py-3 shadow-sm ${toneClassMap[notification.type]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{notification.title}</p>
          {notification.message ? <p className="mt-1 text-xs">{notification.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          Cerrar
        </button>
      </div>
    </article>
  );
}

export function NotificationCenter() {
  const notifications = useUiStore((state) => state.notifications);
  const dismissNotification = useUiStore((state) => state.dismissNotification);

  if (!notifications.length) {
    return null;
  }

  return (
    <section className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onDismiss={dismissNotification} />
        </div>
      ))}
    </section>
  );
}
