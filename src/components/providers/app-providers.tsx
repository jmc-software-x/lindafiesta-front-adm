'use client';

import { GlobalErrorBanner } from '@/components/feedback/global-error-banner';
import { GlobalLoadingBar } from '@/components/feedback/global-loading-bar';
import { NotificationCenter } from '@/components/feedback/notification-center';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GlobalLoadingBar />
      <NotificationCenter />
      <GlobalErrorBanner />
    </>
  );
}
