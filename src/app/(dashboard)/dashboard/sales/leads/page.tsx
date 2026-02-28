const leads = [
  { name: 'Camila Paredes', type: '15 anios', attendees: 80, status: 'En cotizacion' },
  { name: 'Jorge y Ana', type: 'Boda', attendees: 120, status: 'Negociacion' },
  { name: 'Colegio Horizonte', type: 'Graduacion', attendees: 200, status: 'Nuevo' },
];

export default function LeadsPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Leads</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Invitados</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.name}>
                <td className="px-4 py-3">{lead.name}</td>
                <td className="px-4 py-3">{lead.type}</td>
                <td className="px-4 py-3">{lead.attendees}</td>
                <td className="px-4 py-3">{lead.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
