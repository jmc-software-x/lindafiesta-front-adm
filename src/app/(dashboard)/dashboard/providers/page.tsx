const providers = [
  { name: 'Catering Imperial', service: 'Catering', city: 'Lima', rating: 4.7 },
  { name: 'Studio Florencia', service: 'Decoracion', city: 'Madrid', rating: 4.6 },
  { name: 'Dulce Atelier', service: 'Tortas', city: 'CDMX', rating: 4.8 },
];

export default function ProvidersPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Proveedores</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Servicio</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
              <th className="px-4 py-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {providers.map((provider) => (
              <tr key={provider.name}>
                <td className="px-4 py-3">{provider.name}</td>
                <td className="px-4 py-3">{provider.service}</td>
                <td className="px-4 py-3">{provider.city}</td>
                <td className="px-4 py-3">{provider.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
