# Frontend Admin - Storage y Documentos Legales (Integracion v1)

Documento acotado para `front-admin`.
Implementacion UI para upload a storage y flujo de documentos HTML/PDF/email.

## Pantallas agregadas

- `/dashboard/catalog/storage`
- `/dashboard/catalog/documents`

## Endpoints consumidos (via API routes de Next)

- `POST /api/files/presign`
- `POST /api/files/presign-get`
- `POST /api/documents/render-html`
- `POST /api/documents/render-pdf`
- `POST /api/documents/send-email`

## Proxy routes nuevas en front-admin

- `src/app/api/documents/render-html/route.ts`
- `src/app/api/documents/render-pdf/route.ts`
- `src/app/api/documents/send-email/route.ts`

Todos propagan cookie + bearer token al backend:

- `POST /documents/render-html`
- `POST /documents/render-pdf`
- `POST /documents/send-email`

## Storage panel

Flujos habilitados:

1. Subida con presigned PUT (`files/presign` + `PUT` directo).
2. Resolver URL temporal por key (`files/presign-get`).
3. Preview por tipo:
   - Imagen: `<img>`
   - Video: `<video>`
   - PDF: `<iframe>`
   - Otros: link de apertura/descarga
4. Historial local de subidas (localStorage).

Tipos soportados en selector UI:

- `image/*`
- `application/pdf`
- `video/*`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

## Documents panel

Flujos habilitados:

1. Render HTML con variables y preview (`/documents/render-html`).
2. Render PDF (preview embebido y descarga) (`/documents/render-pdf`).
3. Enviar email con adjunto PDF opcional (`/documents/send-email`).

Campos operativos:

- `templateHtml`
- `variables` (JSON)
- `fileName`, `title` para PDF
- `to[]`, `subject`, `attachPdf`, `attachmentFileName`, `title` para email

## Controladores reutilizables agregados

- `src/lib/files/image-upload-controller.ts` (ya extendido previamente a objeto generico)
- `src/lib/documents/documents-controller.ts` (nuevo para render-html/pdf/send-email)
