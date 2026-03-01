export const navSections = [
  {
    title: 'General',
    items: [{ label: 'Dashboard', href: '/dashboard' }],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Leads', href: '/dashboard/sales/leads' },
      { label: 'Cotizaciones', href: '/dashboard/sales/quotes' },
      { label: 'Tickets', href: '/dashboard/sales/quote-tickets' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Eventos', href: '/dashboard/operations/events' },
      { label: 'Calendario', href: '/dashboard/operations/calendar' },
      { label: 'Proveedores', href: '/dashboard/providers' },
    ],
  },
  {
    title: 'Catalogo',
    items: [{ label: 'Categorias', href: '/dashboard/catalog/service-categories' }],
  },
  {
    title: 'Configuracion',
    items: [
      { label: 'Usuarios', href: '/dashboard/settings/users' },
      { label: 'Roles', href: '/dashboard/settings/roles' },
      { label: 'Auditoria', href: '/dashboard/settings/audit' },
    ],
  },
] as const;
