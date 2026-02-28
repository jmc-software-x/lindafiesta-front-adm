const events = [
  {
    code: 'EV-2201',
    customer: 'Camila Paredes',
    date: '2026-03-22',
    city: 'Lima',
    status: 'Planificacion',
  },
  {
    code: 'EV-2202',
    customer: 'Jorge y Ana',
    date: '2026-04-02',
    city: 'CDMX',
    status: 'Proveedores confirmados',
  },
];

export default function EventsPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Eventos</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <article key={event.code} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-brand-700">{event.code}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{event.customer}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {event.date} - {event.city}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {event.status}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
