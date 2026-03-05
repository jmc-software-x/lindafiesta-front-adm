'use client';

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  normalizeStorageLookupKey,
  resolveObjectViewUrl,
  SourceMode,
  uploadObjectWithPresign,
} from '@/lib/files/image-upload-controller';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

type FileKind = 'image' | 'video' | 'pdf' | 'other';

interface StoredUploadItem {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  folder: string;
  sourceMode: SourceMode;
  sourceValue: string;
  previewUrl: string | null;
  uploadedAt: string;
}

const RECENT_UPLOADS_KEY = 'lf_admin_recent_blob_uploads';
const MAX_RECENT_UPLOADS = 30;

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function normalizeTtl(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

function detectFileKind(contentType: string, keyOrUrl: string): FileKind {
  const contentTypeLower = contentType.toLowerCase();
  const keyLower = keyOrUrl.toLowerCase();

  if (contentTypeLower.startsWith('image/')) {
    return 'image';
  }

  if (contentTypeLower.startsWith('video/')) {
    return 'video';
  }

  if (contentTypeLower.includes('pdf')) {
    return 'pdf';
  }

  if (/\.(png|jpg|jpeg|webp|avif|gif|bmp|svg)(\?.*)?$/i.test(keyLower)) {
    return 'image';
  }

  if (/\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(keyLower)) {
    return 'video';
  }

  if (/\.pdf(\?.*)?$/i.test(keyLower)) {
    return 'pdf';
  }

  return 'other';
}

function parseRecentUploads(raw: string | null): StoredUploadItem[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is StoredUploadItem => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const record = item as Record<string, unknown>;
        return (
          typeof record.key === 'string' &&
          typeof record.fileName === 'string' &&
          typeof record.contentType === 'string' &&
          typeof record.sizeBytes === 'number' &&
          typeof record.folder === 'string' &&
          typeof record.sourceMode === 'string' &&
          typeof record.sourceValue === 'string' &&
          typeof record.uploadedAt === 'string'
        );
      })
      .slice(0, MAX_RECENT_UPLOADS);
  } catch {
    return [];
  }
}

export default function BlobStorageCatalogPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [sourceMode, setSourceMode] = useState<SourceMode>('key');
  const [folder, setFolder] = useState('catalog/uploads');
  const [signedGetTtlSeconds, setSignedGetTtlSeconds] = useState('600');
  const [shouldResolvePreview, setShouldResolvePreview] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lookupKey, setLookupKey] = useState('');
  const [lookupTtl, setLookupTtl] = useState('600');
  const [lookupUrl, setLookupUrl] = useState('');
  const [isResolvingLookup, setIsResolvingLookup] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewContentType, setPreviewContentType] = useState('');
  const [previewLabel, setPreviewLabel] = useState('');
  const [recentUploads, setRecentUploads] = useState<StoredUploadItem[]>([]);
  const [fileInputResetKey, setFileInputResetKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setRecentUploads(parseRecentUploads(window.localStorage.getItem(RECENT_UPLOADS_KEY)));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(recentUploads));
  }, [recentUploads]);

  const previewKind = useMemo(
    () => detectFileKind(previewContentType, previewUrl || previewLabel),
    [previewContentType, previewLabel, previewUrl]
  );

  const persistRecentUpload = useCallback((item: StoredUploadItem) => {
    setRecentUploads((current) => {
      const deduped = current.filter((entry) => !(entry.key === item.key && entry.uploadedAt === item.uploadedAt));
      return [item, ...deduped].slice(0, MAX_RECENT_UPLOADS);
    });
  }, []);

  const handlePickFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    clearErrors();
    setIsUploading(true);
    startLoading('blob-storage.upload');

    try {
      const upload = await uploadObjectWithPresign({
        file: selectedFile,
        folder: folder.trim() || 'catalog/uploads',
        sourceMode,
        resolvePreviewUrl: shouldResolvePreview,
        signedGetTtlSeconds: normalizeTtl(signedGetTtlSeconds),
      });

      const uploadedAt = new Date().toISOString();
      const recentItem: StoredUploadItem = {
        key: upload.key,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
        folder: folder.trim() || 'catalog/uploads',
        sourceMode,
        sourceValue: upload.sourceValue,
        previewUrl: upload.previewUrl,
        uploadedAt,
      };

      persistRecentUpload(recentItem);
      setLookupKey(upload.key);
      setLookupUrl(upload.previewUrl ?? '');
      setPreviewUrl(upload.previewUrl ?? '');
      setPreviewContentType(selectedFile.type);
      setPreviewLabel(upload.key);
      setSelectedFile(null);
      setFileInputResetKey((value) => value + 1);

      pushNotification({
        type: 'success',
        title: 'Archivo subido',
        message: upload.key,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir el archivo.';
      reportError({
        source: 'api',
        message,
        details: 'Flow files/presign -> PUT Blob/S3',
      });
      pushNotification({
        type: 'error',
        title: 'Error al subir archivo',
        message,
      });
    } finally {
      stopLoading('blob-storage.upload');
      setIsUploading(false);
    }
  };

  const handleResolveByKey = async (key?: string, contentTypeHint?: string) => {
    const source = (key ?? lookupKey).trim();
    if (!source || isResolvingLookup) {
      return;
    }

    setIsResolvingLookup(true);
    startLoading('blob-storage.resolve');

    try {
      const normalizedKey = normalizeStorageLookupKey(source);
      const url = await resolveObjectViewUrl({
        source,
        signedGetTtlSeconds: normalizeTtl(lookupTtl),
      });

      setLookupKey(normalizedKey ?? source);
      setLookupUrl(url);
      setPreviewUrl(url);
      setPreviewContentType(contentTypeHint ?? '');
      setPreviewLabel(normalizedKey ?? source);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar URL firmada.';
      reportError({
        source: 'api',
        message,
        details: 'POST /files/presign-get',
      });
      pushNotification({
        type: 'error',
        title: 'Error al resolver archivo',
        message,
      });
    } finally {
      stopLoading('blob-storage.resolve');
      setIsResolvingLookup(false);
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      pushNotification({
        type: 'success',
        title: `${label} copiado`,
      });
    } catch {
      pushNotification({
        type: 'warning',
        title: 'No se pudo copiar',
        message: 'Tu navegador bloqueo acceso al portapapeles.',
      });
    }
  };

  const clearRecentHistory = () => {
    setRecentUploads([]);
    pushNotification({
      type: 'info',
      title: 'Historial local limpiado',
    });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Blob Storage</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sube archivos y visualiza objetos por <code>s3Key</code> (imagenes, PDF, video y otros).
          </p>
        </div>
      </header>

      <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Tu backend actual puede limitar <code>/files/presign</code> a <code>image/*</code>. Si PDF/video fallan con 400,
        debes ampliar la allowlist de content types en backend.
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Subir archivo</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Folder</span>
            <input
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="catalog/uploads"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Modo de source</span>
            <select
              value={sourceMode}
              onChange={(event) => setSourceMode(event.target.value as SourceMode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              <option value="key">key</option>
              <option value="signedGetUrl">signedGetUrl</option>
              <option value="publicUrl">publicUrl</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              TTL URL firmada (segundos)
            </span>
            <input
              type="number"
              min={60}
              step={60}
              value={signedGetTtlSeconds}
              onChange={(event) => setSignedGetTtlSeconds(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shouldResolvePreview}
              onChange={(event) => setShouldResolvePreview(event.target.checked)}
            />
            Resolver preview al subir
          </label>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`mt-4 rounded-lg border-2 border-dashed px-4 py-8 text-center ${
            isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <p className="text-sm text-slate-700">Arrastra y suelta un archivo aqui o selecciona desde tu equipo.</p>
          <p className="mt-1 text-xs text-slate-500">
            Soporta imagenes, PDF, video, Word (DOC/DOCX) y otros archivos.
          </p>
          <input
            key={fileInputResetKey}
            type="file"
            accept="image/*,application/pdf,video/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handlePickFile}
            className="mx-auto mt-3 block w-full max-w-md text-xs text-slate-600"
          />
          {selectedFile ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700">
              <p>
                <strong>Archivo:</strong> {selectedFile.name}
              </p>
              <p>
                <strong>Tipo:</strong> {selectedFile.type || 'desconocido'}
              </p>
              <p>
                <strong>Peso:</strong> {formatBytes(selectedFile.size)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleUpload();
            }}
            disabled={!selectedFile || isUploading}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? 'Subiendo...' : 'Subir archivo'}
          </button>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Buscar y ver por key</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Source (key / s3 uri / arn / url s3)
            </span>
            <input
              value={lookupKey}
              onChange={(event) => setLookupKey(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="service-categories/file.jpg o s3://bucket/key o arn:aws:s3:::bucket/key"
            />
            <p className="text-[11px] text-slate-500">
              Puedes pegar la URL de S3 (https://bucket.s3.region.amazonaws.com/key) y se normaliza automaticamente.
            </p>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">TTL</span>
            <input
              type="number"
              min={60}
              step={60}
              value={lookupTtl}
              onChange={(event) => setLookupTtl(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void handleResolveByKey();
              }}
              disabled={!lookupKey.trim() || isResolvingLookup}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResolvingLookup ? 'Resolviendo...' : 'Generar URL firmada'}
            </button>
          </div>
        </div>

        {lookupUrl ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="break-all">
              <strong>URL:</strong> {lookupUrl}
            </p>
            <button
              type="button"
              onClick={() => {
                void copyToClipboard(lookupUrl, 'URL');
              }}
              className="mt-2 rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
            >
              Copiar URL
            </button>
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Preview</h3>
        {previewUrl ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">Origen: {previewLabel || 'N/A'}</p>
            {previewKind === 'image' ? (
              <img src={previewUrl} alt={previewLabel || 'Vista previa'} className="max-h-[420px] rounded-lg border border-slate-200 object-contain" />
            ) : null}
            {previewKind === 'video' ? (
              <video controls src={previewUrl} className="max-h-[420px] w-full rounded-lg border border-slate-200 bg-black" />
            ) : null}
            {previewKind === 'pdf' ? (
              <iframe
                title="Vista previa PDF"
                src={previewUrl}
                className="h-[520px] w-full rounded-lg border border-slate-200"
              />
            ) : null}
            {previewKind === 'other' ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No hay preview embebido para este tipo de archivo.
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 font-medium text-brand-700 underline"
                >
                  Abrir archivo
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">Aun no hay archivo seleccionado para preview.</p>
            <p className="mt-1 text-xs text-slate-500">Sube o resuelve por key para visualizarlo aqui.</p>
          </div>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-base font-semibold text-slate-900">Historial local de subidas</h3>
          <button
            type="button"
            onClick={clearRecentHistory}
            className="w-fit rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Limpiar historial
          </button>
        </div>

        {recentUploads.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-700">Sin subidas recientes en este navegador.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Archivo</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUploads.map((item) => (
                  <tr key={`${item.key}-${item.uploadedAt}`}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.fileName}</p>
                      <p className="text-xs text-slate-500">{new Date(item.uploadedAt).toLocaleString()}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{item.contentType || '-'}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{formatBytes(item.sizeBytes)}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      <code className="break-all">{item.key}</code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleResolveByKey(item.key, item.contentType);
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void copyToClipboard(item.key, 'Key');
                          }}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Copiar key
                        </button>
                        {item.sourceValue ? (
                          <button
                            type="button"
                            onClick={() => {
                              void copyToClipboard(item.sourceValue, 'Source');
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Copiar source
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
