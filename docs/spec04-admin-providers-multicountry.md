# Frontend Admin - Providers Multi-country (Spec v1)

Documento acotado para `front-admin`.
Define el contrato minimo que backend debe implementar para reemplazar el mock actual de proveedores.

## 1) Contexto

El dashboard admin necesita registrar y consultar proveedores en varios paises:

- Mexico (`MX`)
- Espana (`ES`)
- Colombia (`CO`)
- Peru (`PE`)
- Venezuela (`VE`)

Frontend guarda ubicacion en campos estables:

- `countryCode` (ISO-2)
- `stateCode` (codigo regional del pais)
- `cityName` (string)

No se depende de IDs internos de la libreria geográfica del frontend.

## 2) Estado actual frontend

Actualmente `front-admin` usa mock local:

- `GET /api/providers`
- `POST /api/providers`

Ruta UI:

- `/dashboard/providers`

Al migrar a backend real, solo se reemplaza consumo de `/api/providers` por proxy a backend core.

## 3) Endpoints backend requeridos

Base esperada:

- `http://127.0.0.1:<PORT>/<apiPrefix>`

### 3.1 Crear proveedor

`POST /providers`

Auth:

- Bearer JWT
- Roles: `ADMIN`, `OPS_MANAGER`

Body:

```json
{
  "name": "Catering Imperial",
  "service": "Catering",
  "countryCode": "PE",
  "countryName": "Peru",
  "stateCode": "LMA",
  "stateName": "Lima",
  "cityName": "Lima",
  "rating": 4.7,
  "phone": "+51900284446",
  "email": "contacto@cateringimperial.pe",
  "isActive": true
}
```

Response `201`:

```json
{
  "id": "prov_xxx",
  "name": "Catering Imperial",
  "service": "Catering",
  "countryCode": "PE",
  "countryName": "Peru",
  "stateCode": "LMA",
  "stateName": "Lima",
  "cityName": "Lima",
  "rating": 4.7,
  "phone": "+51900284446",
  "email": "contacto@cateringimperial.pe",
  "isActive": true,
  "createdAt": "2026-03-01T12:00:00.000Z",
  "updatedAt": "2026-03-01T12:00:00.000Z"
}
```

### 3.2 Listar proveedores con filtros

`GET /providers`

Auth:

- Bearer JWT
- Roles: `ADMIN`, `OPS_MANAGER`, `OPERATOR`, `SALES`

Query params:

- `q` (busqueda libre por nombre/servicio/ubicacion/contacto)
- `countryCode` (ISO-2)
- `stateCode`
- `city`
- `service`
- `includeInactive` (`true|false`)
- `page` (opcional)
- `limit` (opcional)

Response `200`:

```json
{
  "items": [
    {
      "id": "prov_xxx",
      "name": "Catering Imperial",
      "service": "Catering",
      "countryCode": "PE",
      "countryName": "Peru",
      "stateCode": "LMA",
      "stateName": "Lima",
      "cityName": "Lima",
      "rating": 4.7,
      "phone": "+51900284446",
      "email": "contacto@cateringimperial.pe",
      "isActive": true,
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-03-01T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 3.3 Actualizar proveedor (recomendado)

`PATCH /providers/:id`

Auth:

- Bearer JWT
- Roles: `ADMIN`, `OPS_MANAGER`

Body parcial:

```json
{
  "service": "Catering Premium",
  "rating": 4.9,
  "isActive": true
}
```

### 3.4 Desactivar proveedor (recomendado)

`PATCH /providers/:id/status`

Body:

```json
{
  "isActive": false
}
```

## 4) Reglas de validacion backend

- `name`: requerido, 2-160 chars.
- `service`: requerido, 2-120 chars.
- `countryCode`: ISO-2 uppercase.
- `stateCode`: requerido, uppercase.
- `cityName`: requerido, 2-120 chars.
- `rating`: numero entre `0` y `5`.
- `email`: opcional, formato email valido.
- `phone`: opcional.

## 5) Multi-tenant y seguridad

- Tenant scoping obligatorio por JWT (`tenantId`).
- Un tenant no puede ver/editar proveedores de otro tenant.
- Auditoria recomendada en create/update/status.

## 6) Modelo de datos sugerido

Tabla `suppliers`:

- `id`
- `tenant_id`
- `name`
- `service`
- `country_code`
- `country_name`
- `state_code`
- `state_name`
- `city_name`
- `rating`
- `phone`
- `email`
- `is_active`
- `created_at`
- `updated_at`

Indices sugeridos:

- `(tenant_id, country_code, state_code, city_name)`
- `(tenant_id, service)`
- `(tenant_id, is_active)`
- GIN/trigram para busqueda por `name` (opcional).
