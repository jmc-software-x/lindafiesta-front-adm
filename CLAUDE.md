# Front Admin Playbook

## Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS

## Objetivo UX
- Priorizar velocidad operativa: listados, filtros, estados y acciones masivas.
- Evitar pantallas "marketing" en admin.

## Estructura
- `src/app/(auth)` autenticacion.
- `src/app/(dashboard)/dashboard/*` modulos operativos.
- `src/components/layout` shell del dashboard.
- `src/components/kpi` widgets de resumen.

## Convenciones
- Paginas SSR por defecto, client components solo donde aplique interaccion.
- Tabla + filtros + empty state en cada listado.
- Estado visual consistente para workflow:
  - Draft, InProgress, Blocked, Done

## Formato de entrega por tarea
1. Objetivo
2. Rutas y componentes modificados
3. Estado de integracion API
4. Riesgos pendientes
5. Session close
