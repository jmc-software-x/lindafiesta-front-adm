import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'LindaFiestas Admin',
  description: 'Dashboard administrativo de operaciones',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
