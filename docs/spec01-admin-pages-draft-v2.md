# Frontend Admin - Integracion CMS Pages (Draft v2)

Documento acotado para equipo `front-admin`.
Solo cubre gestion de `pages/home` en CMS.

## Base URL

- Local: `http://127.0.0.1:3100/v100`
- El prefijo cambia con `API_VERSION`.

## Auth y permisos

- Requiere `Authorization: Bearer <accessToken>`.
- Rol requerido: `ADMIN`.

## Endpoints

1. `GET /admin/pages/:slug`
2. `PUT /admin/pages/:slug/draft`
3. `POST /admin/pages/:slug/publish`

## 1) Obtener pagina editable

```http
GET /admin/pages/home?locale=es-MX
Authorization: Bearer <token>
```

Respuesta:

```json
{
  "slug": "home",
  "locale": "es-MX",
  "status": "DRAFT",
  "version": 12,
  "blocks": [],
  "theme": {},
  "publishedVersionId": "cmm..."
}
```

## 2) Guardar draft (contrato v2)

```http
PUT /admin/pages/home/draft
Authorization: Bearer <token>
Content-Type: application/json
```

Body requerido:

```json
{
  "schemaVersion": 1,
  "slug": "home",
  "locale": "es-MX",
  "tenant": {
    "countryCode": "MX",
    "cityCode": "GDL"
  },
  "theme": {},
  "blocks": [
    {
      "id": "hero-1",
      "type": "hero-collage",
      "order": 10,
      "isEnabled": true,
      "data": {}
    }
  ]
}
```

Respuesta:

```json
{
  "pageId": "cmm...",
  "slug": "home",
  "locale": "es-MX",
  "versionId": "cmm...",
  "version": 13,
  "status": "DRAFT"
}
```

## 3) Publicar version

```http
POST /admin/pages/home/publish
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "locale": "es-MX",
  "versionId": "cmm..."
}
```

Respuesta:

```json
{
  "pageId": "cmm...",
  "slug": "home",
  "locale": "es-MX",
  "status": "PUBLISHED",
  "publishedVersionId": "cmm...",
  "version": 13
}
```

## Validaciones backend relevantes

- `schemaVersion`: entero `>= 1`.
- `slug` body debe coincidir con `:slug` de ruta.
- `tenant.countryCode`: ISO-2.
- `tenant.cityCode`: uppercase.
- `blocks` no vacio.
- `id` unico por bloque.
- `order` entero `>= 0` y unico.
- `type` dentro del catalogo permitido.
- `data` debe ser objeto.

## Catalogo de `type`

- `hero-collage`
- `about`
- `triptych-images`
- `categories`
- `gallery-grid`
- `cta`
- `promotions`
- `carousel`

## Compatibilidad legacy que normaliza backend

- `triptych` -> `triptych-images`
- `cta.actionLabel/actionHref` -> `data.cta.label/href`
- `gallery-grid.images[]` -> `gallery-grid.items[]`
- `about.description` -> `about.paragraphs[0]`

## Errores esperados

- `400 Bad Request`: payload invalido, slug mismatch, tipo no permitido, duplicados.
- `401 Unauthorized`: token ausente/invalido.
- `403 Forbidden`: rol sin permiso.
- `404 Not Found`: slug/version no encontrada al publicar.

## Flujo recomendado en UI admin

1. Cargar con `GET /admin/pages/home`.
2. Editar estado local `blocks/theme`.
3. Guardar con `PUT /draft` y persistir `versionId`.
4. Publicar explicitamente con `POST /publish`.
5. Refrescar preview publica (`GET /pages/home?...`).
