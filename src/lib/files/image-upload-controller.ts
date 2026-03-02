import { extractErrorMessage } from '@/lib/common/api-response';

export type SourceMode = 'key' | 'publicUrl' | 'signedGetUrl';

interface PresignPutResponse {
  key: string;
  url: string;
}

interface PresignGetResponse {
  url: string;
}

export interface UploadImageInput {
  file: File;
  folder: string;
  sourceMode?: SourceMode;
  signedGetTtlSeconds?: number;
  resolvePreviewUrl?: boolean;
}

export interface UploadImageResult {
  key: string;
  sourceValue: string;
  previewUrl: string | null;
}

export interface UploadObjectInput {
  file: File;
  folder: string;
  sourceMode?: SourceMode;
  signedGetTtlSeconds?: number;
  resolvePreviewUrl?: boolean;
}

export interface UploadObjectResult {
  key: string;
  sourceValue: string;
  previewUrl: string | null;
}

function getPublicBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL?.trim();
  if (!configured) {
    return null;
  }

  return configured.replace(/\/+$/, '');
}

function buildPublicUrlFromKey(key: string): string | null {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/${key.replace(/^\/+/, '')}`;
}

async function createSignedGetUrl(key: string, expiresIn?: number): Promise<string> {
  const response = await fetch('/api/files/presign-get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      ...(typeof expiresIn === 'number' ? { expiresIn } : {}),
    }),
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, 'No se pudo generar URL firmada de lectura.'));
  }

  const parsed = body as PresignGetResponse;
  if (!parsed?.url) {
    throw new Error('Respuesta invalida al generar URL firmada de lectura.');
  }

  return parsed.url;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export interface ResolveImageViewUrlInput {
  source: string;
  signedGetTtlSeconds?: number;
}

export interface ResolveObjectViewUrlInput {
  source: string;
  signedGetTtlSeconds?: number;
}

export async function resolveObjectViewUrl(input: ResolveObjectViewUrlInput): Promise<string> {
  const source = input.source.trim();
  if (!source) {
    throw new Error('No se encontro source para resolver el archivo.');
  }

  if (isHttpUrl(source)) {
    return source;
  }

  return createSignedGetUrl(source, input.signedGetTtlSeconds);
}

export async function resolveImageViewUrl(input: ResolveImageViewUrlInput): Promise<string> {
  return resolveObjectViewUrl(input);
}

export async function uploadObjectWithPresign(input: UploadObjectInput): Promise<UploadObjectResult> {
  const sourceMode = input.sourceMode ?? 'key';
  const resolvePreviewUrl = input.resolvePreviewUrl ?? true;
  const file = input.file;

  if (!file.type.trim()) {
    throw new Error('El archivo no tiene contentType valido.');
  }

  const presignResponse = await fetch('/api/files/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType: file.type,
      folder: input.folder,
    }),
  });

  const presignBody = (await presignResponse.json()) as unknown;

  if (!presignResponse.ok) {
    throw new Error(extractErrorMessage(presignBody, 'No se pudo crear URL de subida.'));
  }

  const presign = presignBody as PresignPutResponse;
  if (!presign?.key || !presign?.url) {
    throw new Error('Respuesta invalida de presign.');
  }

  const s3UploadResponse = await fetch(presign.url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!s3UploadResponse.ok) {
    throw new Error('No se pudo subir archivo a S3.');
  }

  if (sourceMode === 'signedGetUrl') {
    const signedGetUrl = await createSignedGetUrl(presign.key, input.signedGetTtlSeconds);
    return {
      key: presign.key,
      sourceValue: signedGetUrl,
      previewUrl: signedGetUrl,
    };
  }

  if (sourceMode === 'publicUrl') {
    const publicUrl = buildPublicUrlFromKey(presign.key);
    if (!publicUrl) {
      throw new Error(
        'Falta NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL para construir URL publica. Usa modo key o signedGetUrl.'
      );
    }

    const previewUrl = resolvePreviewUrl
      ? await createSignedGetUrl(presign.key, input.signedGetTtlSeconds)
      : publicUrl;

    return {
      key: presign.key,
      sourceValue: publicUrl,
      previewUrl,
    };
  }

  return {
    key: presign.key,
    sourceValue: presign.key,
    previewUrl: resolvePreviewUrl ? await createSignedGetUrl(presign.key, input.signedGetTtlSeconds) : null,
  };
}

export async function uploadImageWithPresign(input: UploadImageInput): Promise<UploadImageResult> {
  if (!input.file.type.startsWith('image/')) {
    throw new Error('Solo se permiten archivos de imagen.');
  }

  return uploadObjectWithPresign(input);
}
