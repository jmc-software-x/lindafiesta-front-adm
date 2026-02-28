# LindaFiestas Front Admin

Dashboard administrativo para ventas, operaciones y seguridad.

## Arranque local
1. `cp -n .env.example .env.local`
2. Configura credenciales seguras en `.env.local`
3. `npm install`
4. `npm run dev`

## Variables de entorno
- `AUTH_SESSION_SECRET`: clave larga y aleatoria para firmar cookies de sesion.
- `ADMIN_AUTH_EMAIL`: correo de acceso del admin.
- `ADMIN_AUTH_PASSWORD_SALT`: salt aleatoria para `scrypt`.
- `ADMIN_AUTH_PASSWORD_HASH`: hash hexadecimal `scrypt` de la contrasena.

Ejemplo para generar salt/hash:
- `node -e "const {randomBytes,scryptSync}=require('crypto'); const p='TuPasswordFuerte!'; const s=randomBytes(16).toString('hex'); const h=scryptSync(p,s,64).toString('hex'); console.log({salt:s,hash:h});"`

## Mapa inicial de rutas
- `/login`
- `/dashboard`
- `/dashboard/sales/leads`
- `/dashboard/sales/quotes`
- `/dashboard/operations/events`
- `/dashboard/operations/calendar`
- `/dashboard/providers`
- `/dashboard/settings/users`
- `/dashboard/settings/roles`
- `/dashboard/settings/audit`
