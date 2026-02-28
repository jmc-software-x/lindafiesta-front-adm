const schedule = [
  { time: '08:00', task: 'Montaje decoracion - EV-2201', owner: 'Operaciones' },
  { time: '10:30', task: 'Entrega catering - EV-2201', owner: 'Proveedor' },
  { time: '14:00', task: 'Revision checklist final - EV-2202', owner: 'Ops Manager' },
];

export default function CalendarPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Calendario operativo</h2>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ul className="space-y-3">
          {schedule.map((entry) => (
            <li key={`${entry.time}-${entry.task}`} className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
              <span className="font-medium text-slate-800">{entry.time}</span>
              <span className="flex-1 px-4 text-slate-700">{entry.task}</span>
              <span className="text-slate-500">{entry.owner}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
