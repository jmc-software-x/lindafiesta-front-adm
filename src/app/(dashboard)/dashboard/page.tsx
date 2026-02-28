import { KpiCard } from '@/components/kpi/kpi-card';

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Resumen operativo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vista general de conversion, ejecucion y cumplimiento.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Leads nuevos" value="34" trend="+12% vs semana pasada" />
        <KpiCard title="Cotizaciones pendientes" value="11" trend="4 por vencer hoy" />
        <KpiCard title="Eventos proximos (7 dias)" value="9" trend="2 requieren proveedor" />
        <KpiCard title="Margen promedio" value="26.8%" trend="+1.3 pp" />
      </div>
    </section>
  );
}
