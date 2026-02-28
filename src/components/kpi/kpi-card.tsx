interface KpiCardProps {
  title: string;
  value: string;
  trend?: string;
}

export function KpiCard({ title, value, trend }: KpiCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {trend ? <p className="mt-1 text-xs text-emerald-600">{trend}</p> : null}
    </article>
  );
}
