# Frontend Admin - Blob Storage Panel (Draft v1)

Documento acotado para equipo `front-admin`.
Solo cubre la nueva seccion de dashboard para subir y visualizar archivos en blob storage.

## Ruta frontend

- `GET /dashboard/catalog/storage`

## Base URL backend

- Local: `http://127.0.0.1:3100/v100`
- El prefijo cambia con `API_VERSION`.

## Auth y permisos

- Requiere `Authorization: Bearer <accessToken>`.
- Rol esperado en dashboard: `ADMIN` (o cualquier rol autenticado si backend lo permite en `/files/*`).

## Endpoints consumidos por la UI

1. `POST /files/presign`
2. `POST /files/presign-get`

## 1) Presign upload

```http
POST /files/presign
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "contentType": "application/pdf",
  "folder": "catalog/uploads"
}
```

Respuesta esperada:

```json
{
  "key": "catalog/uploads/2026/03/file.pdf",
  "url": "https://...signed-put-url..."
}
```

Luego frontend hace `PUT` directo al `url` firmado con `Content-Type` original.

## 2) Presign get (view/download)

```http
POST /files/presign-get
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "key": "catalog/uploads/2026/03/file.pdf",
  "expiresIn": 600
}
```

Respuesta esperada:

```json
{
  "url": "https://...signed-get-url..."
}
```

## Tipos de archivo que el panel intenta soportar

- Imagenes: `image/*`
- PDF: `application/pdf`
- Videos: `video/*`
- Otros binarios (preview no embebido, solo abrir/descargar)

## Requisito backend para compatibilidad completa

`POST /files/presign` no debe restringirse solo a `image/*`.
Debe permitir al menos:

- `application/pdf`
- `video/mp4`, `video/webm`, `video/quicktime`
- (opcional) `application/octet-stream` controlado por policy

Si backend rechaza esos tipos, la UI mostrara error al subir (400/403).

## Comportamiento de UI

1. Subida por drag-and-drop o input file.
2. Resolucion de URL firmada por `s3Key`.
3. Preview condicional:
   - `img` para imagen.
   - `video` para videos.
   - `iframe` para PDF.
   - Link externo para otros tipos.
4. Historial local de subidas en `localStorage` del navegador (no persistido en backend).
