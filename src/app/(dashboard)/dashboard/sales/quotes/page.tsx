const quotes = [
  { id: 'Q-1032', customer: 'Camila Paredes', version: 'v2', total: '$4,200', status: 'Enviada' },
  { id: 'Q-1031', customer: 'Jorge y Ana', version: 'v1', total: '$9,900', status: 'Aprobada' },
];

export default function QuotesPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Cotizaciones</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Codigo</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-3">{quote.id}</td>
                <td className="px-4 py-3">{quote.customer}</td>
                <td className="px-4 py-3">{quote.version}</td>
                <td className="px-4 py-3">{quote.total}</td>
                <td className="px-4 py-3">{quote.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
