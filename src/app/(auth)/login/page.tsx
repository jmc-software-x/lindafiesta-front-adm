'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

interface LoginApiResponse {
  ok: boolean;
  message?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const pushNotification = useUiStore((state) => state.pushNotification);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);
  const isSubmitting = useLoadingStore(
    (state) => (state.pendingKeys['auth.login'] ?? 0) > 0
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);
    clearErrors();
    startLoading('auth.login');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = (await response.json()) as LoginApiResponse;

      if (!response.ok || !result.ok) {
        const message = result.message ?? 'No se pudo iniciar sesion.';
        setFormError(message);
        reportError({
          source: 'auth',
          message,
          details: 'Intenta nuevamente o contacta al administrador.',
        });
        pushNotification({
          type: 'error',
          title: 'Error de autenticacion',
          message,
        });
        return;
      }

      pushNotification({
        type: 'success',
        title: 'Sesion iniciada',
        message: 'Bienvenido al dashboard.',
      });
      router.replace('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado de red.';
      setFormError(message);
      reportError({
        source: 'auth',
        message,
      });
      pushNotification({
        type: 'error',
        title: 'Error de autenticacion',
        message,
      });
    } finally {
      stopLoading('auth.login');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <section className="w-full rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Accede al dashboard de ventas y operaciones.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="admin@lindafiestas.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="********"
            />
          </div>
          {formError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
