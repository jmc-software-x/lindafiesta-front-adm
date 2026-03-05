# Frontend Admin - Providers Multi-country (API Contract v1)

Documento acotado para `front-admin`.
Contrato backend para reemplazar mock de proveedores en `/dashboard/providers`.

## Base URL

- `http://127.0.0.1:<PORT>/<apiPrefix>`
- Ejemplo local: `http://127.0.0.1:3100/v100`

## Auth y roles

- Bearer JWT obligatorio.
- Tenant scoping por `tenantId` del token.

Roles:
- `POST /providers`: `ADMIN`, `OPS_MANAGER`
- `GET /providers`: `ADMIN`, `OPS_MANAGER`, `OPERATOR`, `SALES`
- `PATCH /providers/:id`: `ADMIN`, `OPS_MANAGER`
- `PATCH /providers/:id/status`: `ADMIN`, `OPS_MANAGER`

## 1) Crear proveedor

`POST /providers`

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
  "id": "cmm...",
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
  "createdAt": "2026-03-05T14:00:00.000Z",
  "updatedAt": "2026-03-05T14:00:00.000Z"
}
```

## 2) Listar proveedores con filtros

`GET /providers`

Query params:
- `q`
- `countryCode` (ISO-2)
- `stateCode`
- `city`
- `service`
- `includeInactive` (`true|false`)
- `page` (default `1`)
- `limit` (default `20`, max `100`)

Response `200`:

```json
{
  "items": [
    {
      "id": "cmm...",
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
      "createdAt": "2026-03-05T14:00:00.000Z",
      "updatedAt": "2026-03-05T14:00:00.000Z"
    }
  ],
  "total": 1
}
```

## 3) Actualizar proveedor

`PATCH /providers/:id`

Body parcial:

```json
{
  "service": "Catering Premium",
  "rating": 4.9,
  "isActive": true
}
```

Response `200`: mismo shape de proveedor.

## 4) Activar/Desactivar proveedor

`PATCH /providers/:id/status`

Body:

```json
{
  "isActive": false
}
```

Response `200`: mismo shape de proveedor con estado actualizado.

## Validaciones backend

- `name`: requerido, `2-160`.
- `service`: requerido, `2-120`.
- `countryCode`: ISO-2 uppercase.
- `countryName`: requerido, `2-80`.
- `stateCode`: requerido, uppercase.
- `stateName`: requerido, `2-120`.
- `cityName`: requerido, `2-120`.
- `rating`: `0..5`.
- `email`: opcional, formato email.
- `phone`: opcional.

## Errores esperados

- `400 Bad Request`: body/query invalido.
- `401 Unauthorized`: token ausente/invalido.
- `403 Forbidden`: rol sin permiso.
- `404 Not Found`: proveedor no encontrado en tenant.
