import Link from 'next/link';
import { navSections } from '@/lib/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">LindaFiestas</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Admin Dashboard</h1>
        </div>
        <nav className="space-y-6 p-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{section.title}</p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <section className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <p className="text-sm text-slate-600">Pais/Ciudad: Peru / Lima</p>
          <p className="text-sm font-medium text-slate-700">ADMIN</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </section>
    </div>
  );
}
