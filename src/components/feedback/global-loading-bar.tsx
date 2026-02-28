'use client';

import { useLoadingStore } from '@/stores/loading-store';

export function GlobalLoadingBar() {
  const hasPendingLoading = useLoadingStore((state) =>
    Object.values(state.pendingKeys).some((value) => value > 0)
  );

  if (!hasPendingLoading) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-pulse rounded-r-full bg-brand-500" />
    </div>
  );
}
