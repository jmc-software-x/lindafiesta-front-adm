'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

interface HeaderUserControlsProps {
  userEmail: string;
  userRole: 'ADMIN';
}

export function HeaderUserControls({ userEmail, userRole }: HeaderUserControlsProps) {
  const router = useRouter();
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    startLoading('auth.logout');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('No se pudo cerrar la sesion.');
      }

      pushNotification({
        type: 'info',
        title: 'Sesion cerrada',
        message: 'Hasta luego.',
        durationMs: 2500,
      });
      router.replace('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al cerrar sesion.';
      reportError({
        source: 'auth',
        message,
      });
      pushNotification({
        type: 'error',
        title: 'Error al cerrar sesion',
        message,
      });
    } finally {
      stopLoading('auth.logout');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-slate-700">{userRole}</p>
        <p className="text-xs text-slate-500">{userEmail}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Cerrando...' : 'Cerrar sesion'}
      </button>
    </div>
  );
}
