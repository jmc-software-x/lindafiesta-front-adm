'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { extractErrorMessage } from '@/lib/common/api-response';
import { uploadImageWithPresign } from '@/lib/files/image-upload-controller';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

interface ServiceCategoryImage {
  id: string;
  s3Key: string;
  url: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  altText?: string | null;
  sortOrder: number;
}

interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  images: ServiceCategoryImage[];
}

interface CreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface UpdateCategoryPayload {
  name?: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface EditDraft {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

interface ImageUploadDraft {
  file: File | null;
  altText: string;
  sortOrder: string;
}

const INITIAL_CREATE_FORM: CreateCategoryPayload = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  isActive: true,
};

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export default function ServiceCategoriesPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);
  const [uploadingCategoryId, setUploadingCategoryId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [createForm, setCreateForm] = useState<CreateCategoryPayload>(INITIAL_CREATE_FORM);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [imageDrafts, setImageDrafts] = useState<Record<string, ImageUploadDraft>>({});

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return categories;
    }

    return categories.filter((category) => {
      const haystack = [
        category.name,
        category.slug,
        category.description ?? '',
        category.isActive ? 'activo' : 'inactivo',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [categories, searchTerm]);

  const loadCategories = useCallback(
    async (nextIncludeInactive = includeInactive) => {
      setIsFetching(true);
      setLoadError(null);
      startLoading('service-categories.fetch');

      try {
        const query = new URLSearchParams({
          includeInactive: nextIncludeInactive ? 'true' : 'false',
          withSignedUrls: 'true',
          signedUrlTtlSeconds: '600',
        });

        const response = await fetch(`/api/service-categories?${query.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(extractErrorMessage(payload, 'No se pudo cargar categorias.'));
        }

        if (!Array.isArray(payload)) {
          throw new Error('Respuesta invalida al listar categorias.');
        }

        const parsedCategories = payload.filter((item): item is ServiceCategory => {
          if (!item || typeof item !== 'object') {
            return false;
          }

          const record = item as Record<string, unknown>;
          return (
            typeof record.id === 'string' &&
            typeof record.slug === 'string' &&
            typeof record.name === 'string' &&
            Array.isArray(record.images)
          );
        });

        setCategories(parsedCategories);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado al listar categorias.';
        setLoadError(message);
        reportError({
          source: 'api',
          message,
          details: 'GET /service-categories',
        });
      } finally {
        stopLoading('service-categories.fetch');
        setIsFetching(false);
      }
    },
    [includeInactive, reportError, startLoading, stopLoading]
  );

  useEffect(() => {
    void loadCategories(includeInactive);
  }, [includeInactive, loadCategories]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    clearErrors();
    setIsCreating(true);
    startLoading('service-categories.create');

    try {
      const payload: CreateCategoryPayload = {
        name: createForm.name.trim(),
        slug: normalizeOptionalText(String(createForm.slug ?? '')),
        description: normalizeOptionalText(String(createForm.description ?? '')),
        isActive: Boolean(createForm.isActive),
      };

      const sortOrderValue = Number(createForm.sortOrder ?? 0);
      if (Number.isFinite(sortOrderValue)) {
        payload.sortOrder = sortOrderValue;
      }

      const response = await fetch('/api/service-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo crear la categoria.'));
      }

      pushNotification({
        type: 'success',
        title: 'Categoria creada',
        message: payload.name,
      });

      setCreateForm(INITIAL_CREATE_FORM);
      await loadCategories(includeInactive);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al crear categoria.';
      reportError({
        source: 'api',
        message,
        details: 'POST /service-categories',
      });
      pushNotification({
        type: 'error',
        title: 'Error al crear categoria',
        message,
      });
    } finally {
      stopLoading('service-categories.create');
      setIsCreating(false);
    }
  };

  const startEditing = (category: ServiceCategory) => {
    setEditDrafts((current) => ({
      ...current,
      [category.id]: {
        name: category.name,
        slug: category.slug,
        description: category.description ?? '',
        sortOrder: String(category.sortOrder),
        isActive: category.isActive,
      },
    }));
  };

  const cancelEditing = (categoryId: string) => {
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
  };

  const saveCategory = async (categoryId: string) => {
    const draft = editDrafts[categoryId];
    if (!draft || updatingCategoryId) {
      return;
    }

    setUpdatingCategoryId(categoryId);
    startLoading(`service-categories.update.${categoryId}`);

    try {
      const payload: UpdateCategoryPayload = {
        name: draft.name.trim(),
        slug: normalizeOptionalText(draft.slug),
        description: normalizeOptionalText(draft.description),
        isActive: draft.isActive,
      };

      const numericSort = Number(draft.sortOrder);
      if (Number.isFinite(numericSort)) {
        payload.sortOrder = numericSort;
      }

      const response = await fetch(`/api/service-categories/${categoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo actualizar la categoria.'));
      }

      pushNotification({
        type: 'success',
        title: 'Categoria actualizada',
      });

      cancelEditing(categoryId);
      await loadCategories(includeInactive);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al actualizar categoria.';
      reportError({
        source: 'api',
        message,
        details: 'PATCH /service-categories/:id',
      });
      pushNotification({
        type: 'error',
        title: 'Error al actualizar',
        message,
      });
    } finally {
      stopLoading(`service-categories.update.${categoryId}`);
      setUpdatingCategoryId(null);
    }
  };

  const setImageFile = (categoryId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageDrafts((current) => ({
      ...current,
      [categoryId]: {
        file,
        altText: current[categoryId]?.altText ?? '',
        sortOrder: current[categoryId]?.sortOrder ?? '',
      },
    }));
  };

  const updateImageDraft = (categoryId: string, next: Partial<ImageUploadDraft>) => {
    setImageDrafts((current) => ({
      ...current,
      [categoryId]: {
        file: current[categoryId]?.file ?? null,
        altText: current[categoryId]?.altText ?? '',
        sortOrder: current[categoryId]?.sortOrder ?? '',
        ...next,
      },
    }));
  };

  const uploadImageForCategory = async (categoryId: string) => {
    const draft = imageDrafts[categoryId];
    if (!draft?.file || uploadingCategoryId) {
      return;
    }

    const file = draft.file;

    setUploadingCategoryId(categoryId);
    startLoading(`service-categories.upload.${categoryId}`);

    try {
      const uploadedImage = await uploadImageWithPresign({
        file,
        folder: 'service-categories',
        sourceMode: 'key',
        resolvePreviewUrl: false,
      });

      const registerPayload: Record<string, unknown> = {
        s3Key: uploadedImage.key,
        contentType: file.type,
        sizeBytes: file.size,
      };

      const altText = normalizeOptionalText(draft.altText);
      if (altText) {
        registerPayload.altText = altText;
      }

      const sortOrderNumber = Number(draft.sortOrder);
      if (Number.isFinite(sortOrderNumber)) {
        registerPayload.sortOrder = sortOrderNumber;
      }

      const registerResponse = await fetch(`/api/service-categories/${categoryId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerPayload),
      });

      const registerBody = (await registerResponse.json()) as unknown;

      if (!registerResponse.ok) {
        throw new Error(extractErrorMessage(registerBody, 'No se pudo registrar la imagen.'));
      }

      pushNotification({
        type: 'success',
        title: 'Imagen cargada',
        message: file.name,
      });

      setImageDrafts((current) => ({
        ...current,
        [categoryId]: {
          file: null,
          altText: '',
          sortOrder: '',
        },
      }));

      await loadCategories(includeInactive);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al subir imagen.';
      reportError({
        source: 'api',
        message,
        details: 'Flow presign -> PUT S3 -> add image',
      });
      pushNotification({
        type: 'error',
        title: 'Error al subir imagen',
        message,
      });
    } finally {
      stopLoading(`service-categories.upload.${categoryId}`);
      setUploadingCategoryId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Categorias de servicio</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gestiona el catalogo que consume la web de clientes (categorias e imagenes).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
              }}
            />
            Incluir inactivas
          </label>
          <button
            type="button"
            onClick={() => {
              void loadCategories(includeInactive);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {isFetching ? 'Actualizando...' : 'Actualizar listado'}
          </button>
        </div>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Nueva categoria</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</span>
            <input
              required
              value={createForm.name ?? ''}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Matrimonios"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Slug (opcional)</span>
            <input
              value={String(createForm.slug ?? '')}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, slug: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="matrimonios"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Descripcion</span>
            <textarea
              value={String(createForm.description ?? '')}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, description: event.target.value }))
              }
              className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Produccion integral para bodas y matrimonios..."
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Sort order</span>
            <input
              type="number"
              min={0}
              max={999}
              value={Number(createForm.sortOrder ?? 0)}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(createForm.isActive)}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />
            Activa
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Creando...' : 'Crear categoria'}
            </button>
          </div>
        </form>
      </article>

      <article className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="w-full md:max-w-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Buscar categoria
            </span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="nombre, slug o estado"
            />
          </label>
          <p className="text-sm text-slate-600">
            {filteredCategories.length} categorias mostradas / {categories.length} totales
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => {
                void loadCategories(includeInactive);
              }}
              className="mt-2 rounded border border-rose-300 px-2 py-1 text-xs font-medium hover:bg-rose-100"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {filteredCategories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No hay categorias para mostrar.</p>
            <p className="mt-1 text-xs text-slate-500">
              Crea una categoria o ajusta filtros para ver resultados.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Estado / orden</th>
                  <th className="px-4 py-3 font-medium">Imagenes</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => {
                  const edit = editDrafts[category.id];
                  const uploadDraft = imageDrafts[category.id] ?? {
                    file: null,
                    altText: '',
                    sortOrder: '',
                  };
                  const isEditing = Boolean(edit);
                  const isUpdatingThis = updatingCategoryId === category.id;
                  const isUploadingThis = uploadingCategoryId === category.id;

                  return (
                    <tr key={category.id} className="align-top">
                      <td className="space-y-2 px-4 py-3">
                        {isEditing ? (
                          <>
                            <input
                              value={edit.name}
                              onChange={(event) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [category.id]: { ...edit, name: event.target.value },
                                }))
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                            <input
                              value={edit.slug}
                              onChange={(event) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [category.id]: { ...edit, slug: event.target.value },
                                }))
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                            <textarea
                              value={edit.description}
                              onChange={(event) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [category.id]: { ...edit, description: event.target.value },
                                }))
                              }
                              className="h-16 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-900">{category.name}</p>
                            <p className="text-xs text-slate-500">{category.slug}</p>
                            <p className="text-xs text-slate-600">{category.description ?? '-'}</p>
                          </>
                        )}
                      </td>
                      <td className="space-y-2 px-4 py-3">
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={edit.sortOrder}
                              onChange={(event) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [category.id]: { ...edit, sortOrder: event.target.value },
                                }))
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={edit.isActive}
                                onChange={(event) =>
                                  setEditDrafts((current) => ({
                                    ...current,
                                    [category.id]: { ...edit, isActive: event.target.checked },
                                  }))
                                }
                              />
                              Activa
                            </label>
                          </>
                        ) : (
                          <>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                category.isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {category.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                            <p className="text-xs text-slate-600">Sort: {category.sortOrder}</p>
                            <p className="text-xs text-slate-500">ID: {category.id}</p>
                          </>
                        )}
                      </td>
                      <td className="space-y-2 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {category.images.length ? (
                            category.images.slice(0, 4).map((image) => (
                              <figure
                                key={image.id}
                                className="h-14 w-14 overflow-hidden rounded border border-slate-200 bg-slate-50"
                              >
                                {image.url ? (
                                  <img
                                    src={image.url}
                                    alt={image.altText || category.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-slate-500">
                                    sin URL
                                  </div>
                                )}
                              </figure>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">Sin imagenes</p>
                          )}
                          {category.images.length > 4 ? (
                            <span className="inline-flex items-center rounded bg-slate-100 px-2 text-xs text-slate-600">
                              +{category.images.length - 4}
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-2 rounded-md border border-slate-200 p-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
                            onChange={(event) => setImageFile(category.id, event)}
                            className="w-full text-xs text-slate-600"
                          />
                          <input
                            value={uploadDraft.altText}
                            onChange={(event) =>
                              updateImageDraft(category.id, { altText: event.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            placeholder="Alt text (opcional)"
                          />
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={uploadDraft.sortOrder}
                            onChange={(event) =>
                              updateImageDraft(category.id, { sortOrder: event.target.value })
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                            placeholder="Sort"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void uploadImageForCategory(category.id);
                            }}
                            disabled={!uploadDraft.file || isUploadingThis}
                            className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUploadingThis ? 'Subiendo...' : 'Subir imagen'}
                          </button>
                        </div>
                      </td>
                      <td className="space-y-2 px-4 py-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void saveCategory(category.id);
                              }}
                              disabled={isUpdatingThis}
                              className="rounded bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                            >
                              {isUpdatingThis ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEditing(category.id)}
                              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(category)}
                            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
