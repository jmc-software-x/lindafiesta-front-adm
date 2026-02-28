'use client';

import { useErrorStore } from '@/stores/error-store';

const sourceLabelMap = {
  auth: 'Autenticacion',
  api: 'API',
  ui: 'Interfaz',
  unknown: 'General',
} as const;

export function GlobalErrorBanner() {
  const latestError = useErrorStore((state) => state.errors[0] ?? null);
  const dismissError = useErrorStore((state) => state.dismissError);

  if (!latestError) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 shadow-sm"
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            Error ({sourceLabelMap[latestError.source]})
          </p>
          <p className="mt-1 text-sm">{latestError.message}</p>
          {latestError.details ? <p className="mt-1 text-xs">{latestError.details}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => dismissError(latestError.id)}
          className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
        >
          Ocultar
        </button>
      </div>
    </aside>
  );
}
