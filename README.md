# LindaFiestas Front Admin

Dashboard administrativo para ventas, operaciones y seguridad.

## Arranque local
1. `cp -n .env.example .env.local`
2. Configura credenciales seguras en `.env.local`
3. `npm install`
4. `npm run dev`

## Variables de entorno
- `AUTH_SESSION_SECRET`: clave larga y aleatoria para firmar cookies de sesion.
- `ADMIN_AUTH_MIN_PASSWORD_LENGTH`: minimo permitido para validar input (default `8` local, `12` production).
- `AUTH_DEFAULT_TENANT_ID`: tenant por defecto enviado al backend en login.
- `NEXT_PUBLIC_AUTH_DEFAULT_TENANT_ID`: tenant por defecto visible en formulario login.
- `BACKEND_API_BASE_URL`: base URL del backend con prefijo versionado (ej: `http://127.0.0.1:3000/v100`).

## Integracion auth/tenancy
- Login usa proxy local `POST /api/auth/login` -> backend `POST /auth/login`.
- Front carga tenants desde `GET /api/tenants/public` -> backend `GET /tenants/public`.
- Si la carga de tenants falla, el formulario permite ingreso manual de `tenantId`.

## Mapa inicial de rutas
- `/login`
- `/dashboard`
- `/dashboard/sales/leads`
- `/dashboard/sales/quotes`
- `/dashboard/operations/events`
- `/dashboard/operations/calendar`
- `/dashboard/providers`
- `/dashboard/catalog/service-categories`
- `/dashboard/settings/users`
- `/dashboard/settings/roles`
- `/dashboard/settings/audit`
