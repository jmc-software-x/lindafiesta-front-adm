'use client';

import { FormEvent, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { City, Country, ICity, ICountry, IState, State } from 'country-state-city';
import { extractErrorMessage } from '@/lib/common/api-response';
import { ProviderRecord } from '@/lib/providers/provider-types';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

const OPERATING_COUNTRY_CODES = ['MX', 'ES', 'CO', 'PE', 'VE'] as const;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface ProvidersFilters {
  q: string;
  countryCode: string;
  stateCode: string;
  city: string;
  service: string;
  includeInactive: boolean;
}

interface CreateProviderForm {
  name: string;
  service: string;
  countryCode: string;
  stateCode: string;
  cityName: string;
  rating: string;
  phone: string;
  email: string;
  isActive: boolean;
}

interface EditProviderForm {
  name: string;
  service: string;
  rating: string;
  phone: string;
  email: string;
}

interface ProvidersListResponse {
  items: ProviderRecord[];
  total: number;
}

const INITIAL_FILTERS: ProvidersFilters = {
  q: '',
  countryCode: '',
  stateCode: '',
  city: '',
  service: '',
  includeInactive: true,
};

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString();
}

function getOperatingCountries(): ICountry[] {
  return Country.getAllCountries()
    .filter((country) => OPERATING_COUNTRY_CODES.includes(country.isoCode as (typeof OPERATING_COUNTRY_CODES)[number]))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function getDefaultForm(countries: ICountry[]): CreateProviderForm {
  const defaultCountry = countries.find((country) => country.isoCode === 'PE') ?? countries[0];
  const defaultState = defaultCountry ? State.getStatesOfCountry(defaultCountry.isoCode)[0] : undefined;
  const defaultCity =
    defaultCountry && defaultState
      ? City.getCitiesOfState(defaultCountry.isoCode, defaultState.isoCode)[0]
      : undefined;

  return {
    name: '',
    service: '',
    countryCode: defaultCountry?.isoCode ?? '',
    stateCode: defaultState?.isoCode ?? '',
    cityName: defaultCity?.name ?? '',
    rating: '4.5',
    phone: '',
    email: '',
    isActive: true,
  };
}

function toEditForm(provider: ProviderRecord): EditProviderForm {
  return {
    name: provider.name,
    service: provider.service,
    rating: provider.rating.toFixed(1),
    phone: provider.phone ?? '',
    email: provider.email ?? '',
  };
}

export default function ProvidersPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const countries = useMemo(() => getOperatingCountries(), []);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [filters, setFilters] = useState<ProvidersFilters>(INITIAL_FILTERS);
  const [createForm, setCreateForm] = useState<CreateProviderForm>(() => getDefaultForm(countries));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalProviders, setTotalProviders] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [actionProviderId, setActionProviderId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditProviderForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.isoCode === createForm.countryCode) ?? null,
    [countries, createForm.countryCode]
  );

  const stateOptions = useMemo<IState[]>(
    () => (createForm.countryCode ? State.getStatesOfCountry(createForm.countryCode) : []),
    [createForm.countryCode]
  );

  const selectedState = useMemo(
    () => stateOptions.find((state) => state.isoCode === createForm.stateCode) ?? null,
    [createForm.stateCode, stateOptions]
  );

  const cityOptions = useMemo<ICity[]>(
    () =>
      createForm.countryCode && createForm.stateCode
        ? City.getCitiesOfState(createForm.countryCode, createForm.stateCode)
        : [],
    [createForm.countryCode, createForm.stateCode]
  );

  const filterStateOptions = useMemo<IState[]>(
    () => (filters.countryCode ? State.getStatesOfCountry(filters.countryCode) : []),
    [filters.countryCode]
  );

  const providersByCountry = useMemo(() => {
    const summary = new Map<string, { countryName: string; count: number }>();
    providers.forEach((provider) => {
      const key = provider.countryCode;
      const current = summary.get(key) ?? { countryName: provider.countryName, count: 0 };
      summary.set(key, {
        countryName: current.countryName,
        count: current.count + 1,
      });
    });

    return Array.from(summary.entries())
      .map(([countryCode, value]) => ({ countryCode, ...value }))
      .sort((a, b) => a.countryName.localeCompare(b.countryName, 'es'));
  }, [providers]);

  const totalPages = useMemo(() => {
    const computed = Math.ceil(totalProviders / limit);
    return Math.max(1, computed || 1);
  }, [limit, totalProviders]);

  const updateFilters = useCallback((next: SetStateAction<ProvidersFilters>) => {
    setPage(1);
    setFilters((current) => {
      if (typeof next === 'function') {
        return (next as (currentValue: ProvidersFilters) => ProvidersFilters)(current);
      }

      return next;
    });
  }, []);

  const loadProviders = useCallback(async () => {
    setIsFetching(true);
    setLoadError(null);
    startLoading('providers.fetch');

    try {
      const query = new URLSearchParams();
      if (filters.q.trim()) {
        query.set('q', filters.q.trim());
      }
      if (filters.countryCode) {
        query.set('countryCode', filters.countryCode);
      }
      if (filters.stateCode) {
        query.set('stateCode', filters.stateCode);
      }
      if (filters.city.trim()) {
        query.set('city', filters.city.trim());
      }
      if (filters.service.trim()) {
        query.set('service', filters.service.trim());
      }
      query.set('includeInactive', filters.includeInactive ? 'true' : 'false');
      query.set('page', String(page));
      query.set('limit', String(limit));

      const response = await fetch(`/api/providers?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo listar proveedores.'));
      }

      const parsed = body as ProvidersListResponse;
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const total = typeof parsed.total === 'number' ? parsed.total : items.length;

      setProviders(items);
      setTotalProviders(total);
      const computedTotalPages = Math.max(1, Math.ceil(total / limit));
      if (page > computedTotalPages) {
        setPage(computedTotalPages);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al listar proveedores.';
      setLoadError(message);
      reportError({
        source: 'api',
        message,
        details: 'GET /providers',
      });
    } finally {
      stopLoading('providers.fetch');
      setIsFetching(false);
    }
  }, [filters, limit, page, reportError, startLoading, stopLoading]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const handleCountryChange = (countryCode: string) => {
    const nextStates = countryCode ? State.getStatesOfCountry(countryCode) : [];
    const nextStateCode = nextStates[0]?.isoCode ?? '';
    const nextCities = countryCode && nextStateCode ? City.getCitiesOfState(countryCode, nextStateCode) : [];

    setCreateForm((current) => ({
      ...current,
      countryCode,
      stateCode: nextStateCode,
      cityName: nextCities[0]?.name ?? '',
    }));
  };

  const handleStateChange = (stateCode: string) => {
    const nextCities =
      createForm.countryCode && stateCode ? City.getCitiesOfState(createForm.countryCode, stateCode) : [];

    setCreateForm((current) => ({
      ...current,
      stateCode,
      cityName: nextCities[0]?.name ?? '',
    }));
  };

  const handleCreateProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    clearErrors();
    setIsCreating(true);
    startLoading('providers.create');

    try {
      const selectedCountryName = selectedCountry?.name ?? '';
      const selectedStateName =
        selectedState?.name ?? stateOptions.find((state) => state.isoCode === createForm.stateCode)?.name ?? '';

      const payload = {
        name: createForm.name.trim(),
        service: createForm.service.trim(),
        countryCode: createForm.countryCode,
        countryName: selectedCountryName,
        stateCode: createForm.stateCode,
        stateName: selectedStateName,
        cityName: createForm.cityName.trim(),
        rating: Number(createForm.rating),
        phone: createForm.phone.trim(),
        email: createForm.email.trim(),
        isActive: createForm.isActive,
      };

      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo crear proveedor.'));
      }

      pushNotification({
        type: 'success',
        title: 'Proveedor creado',
        message: `${payload.name} (${payload.countryCode}-${payload.stateCode})`,
      });

      setCreateForm((current) => ({
        ...getDefaultForm(countries),
        countryCode: current.countryCode,
        stateCode: current.stateCode,
        cityName: current.cityName,
      }));
      setPage(1);
      await loadProviders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al crear proveedor.';
      reportError({
        source: 'api',
        message,
        details: 'POST /providers',
      });
      pushNotification({
        type: 'error',
        title: 'Error al crear proveedor',
        message,
      });
    } finally {
      stopLoading('providers.create');
      setIsCreating(false);
    }
  };

  const handleStartEdit = (provider: ProviderRecord) => {
    setEditingProviderId(provider.id);
    setEditForm(toEditForm(provider));
  };

  const handleCancelEdit = () => {
    setEditingProviderId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async (providerId: string) => {
    if (!editForm || editingProviderId !== providerId || actionProviderId) {
      return;
    }

    const ratingValue = Number(editForm.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) {
      const message = 'El rating debe estar entre 0 y 5.';
      pushNotification({
        type: 'error',
        title: 'Datos invalidos',
        message,
      });
      return;
    }

    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      service: editForm.service.trim(),
      rating: ratingValue,
    };

    const phone = editForm.phone.trim();
    if (phone) {
      payload.phone = phone;
    }

    const email = editForm.email.trim();
    if (email) {
      payload.email = email;
    }

    clearErrors();
    setActionProviderId(providerId);
    startLoading(`providers.update.${providerId}`);

    try {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo actualizar proveedor.'));
      }

      pushNotification({
        type: 'success',
        title: 'Proveedor actualizado',
        message: 'Los cambios se guardaron correctamente.',
      });

      setEditingProviderId(null);
      setEditForm(null);
      await loadProviders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al actualizar proveedor.';
      reportError({
        source: 'api',
        message,
        details: `PATCH /providers/${providerId}`,
      });
      pushNotification({
        type: 'error',
        title: 'Error al actualizar proveedor',
        message,
      });
    } finally {
      stopLoading(`providers.update.${providerId}`);
      setActionProviderId(null);
    }
  };

  const handleToggleStatus = async (provider: ProviderRecord) => {
    if (actionProviderId) {
      return;
    }

    const nextStatus = !provider.isActive;
    clearErrors();
    setActionProviderId(provider.id);
    startLoading(`providers.status.${provider.id}`);

    try {
      const response = await fetch(`/api/providers/${provider.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo cambiar estado del proveedor.'));
      }

      pushNotification({
        type: 'success',
        title: nextStatus ? 'Proveedor activado' : 'Proveedor desactivado',
        message: provider.name,
      });

      await loadProviders();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error inesperado al cambiar estado del proveedor.';
      reportError({
        source: 'api',
        message,
        details: `PATCH /providers/${provider.id}/status`,
      });
      pushNotification({
        type: 'error',
        title: 'Error al cambiar estado',
        message,
      });
    } finally {
      stopLoading(`providers.status.${provider.id}`);
      setActionProviderId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Proveedores</h2>
        <p className="text-sm text-slate-600">
          Registro y organizacion por ubicacion con codigos estables: <code>countryCode</code>, <code>stateCode</code>,
          <code>cityName</code>.
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Nuevo proveedor</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateProvider}>
          <label className="space-y-1 xl:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</span>
            <input
              required
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Proveedor Ejemplo SAC"
            />
          </label>

          <label className="space-y-1 xl:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Servicio</span>
            <input
              required
              value={createForm.service}
              onChange={(event) => setCreateForm((current) => ({ ...current, service: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Catering, Decoracion, Fotografia..."
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Pais</span>
            <select
              required
              value={createForm.countryCode}
              onChange={(event) => handleCountryChange(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              {countries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name} ({country.isoCode})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Estado / Region</span>
            <select
              required
              value={createForm.stateCode}
              onChange={(event) => handleStateChange(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              {stateOptions.map((state) => (
                <option key={state.isoCode} value={state.isoCode}>
                  {state.name} ({state.isoCode})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Ciudad</span>
            {cityOptions.length > 0 ? (
              <select
                required
                value={createForm.cityName}
                onChange={(event) => setCreateForm((current) => ({ ...current, cityName: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              >
                {cityOptions.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                value={createForm.cityName}
                onChange={(event) => setCreateForm((current) => ({ ...current, cityName: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                placeholder="Miraflores"
              />
            )}
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Rating</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={createForm.rating}
              onChange={(event) => setCreateForm((current) => ({ ...current, rating: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Telefono</span>
            <input
              value={createForm.phone}
              onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="+51999888777"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
            <input
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="contacto@proveedor.com"
            />
          </label>

          <label className="inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(event) => setCreateForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Activo
          </label>

          <div className="md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Guardando...' : 'Registrar proveedor'}
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Filtros</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 xl:col-span-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Buscar</span>
            <input
              value={filters.q}
              onChange={(event) => updateFilters((current) => ({ ...current, q: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="nombre, servicio, ciudad, telefono..."
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Pais</span>
            <select
              value={filters.countryCode}
              onChange={(event) => {
                const nextCountryCode = event.target.value;
                updateFilters((current) => ({
                  ...current,
                  countryCode: nextCountryCode,
                  stateCode: '',
                }));
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              <option value="">Todos</option>
              {countries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Estado</span>
            <select
              value={filters.stateCode}
              onChange={(event) => updateFilters((current) => ({ ...current, stateCode: event.target.value }))}
              disabled={!filters.countryCode}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
            >
              <option value="">Todos</option>
              {filterStateOptions.map((state) => (
                <option key={state.isoCode} value={state.isoCode}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Ciudad</span>
            <input
              value={filters.city}
              onChange={(event) => updateFilters((current) => ({ ...current, city: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Lima, Madrid, Bogota..."
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Servicio</span>
            <input
              value={filters.service}
              onChange={(event) => updateFilters((current) => ({ ...current, service: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="Catering"
            />
          </label>

          <label className="inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeInactive}
              onChange={(event) => updateFilters((current) => ({ ...current, includeInactive: event.target.checked }))}
            />
            Incluir inactivos
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Pagina size</span>
            <select
              value={String(limit)}
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value));
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2 xl:col-span-2">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setFilters(INITIAL_FILTERS);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              onClick={() => {
                void loadProviders();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {isFetching ? 'Actualizando...' : 'Actualizar listado'}
            </button>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Distribucion por pais (pagina actual)</h3>
        {providersByCountry.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin proveedores cargados.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {providersByCountry.map((item) => (
              <span
                key={item.countryCode}
                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {item.countryName} ({item.countryCode}): {item.count}
              </span>
            ))}
          </div>
        )}
      </article>

      <article className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Listado de proveedores</h3>
          <p className="text-sm text-slate-600">
            {providers.length} de {totalProviders} registros | Pagina {page} de {totalPages}
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p>{loadError}</p>
          </div>
        ) : null}

        {providers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No hay proveedores para mostrar.</p>
            <p className="mt-1 text-xs text-slate-500">
              Registra proveedores o ajusta filtros para ver resultados.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Servicio</th>
                  <th className="px-4 py-3 font-medium">Pais / estado / ciudad</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providers.map((provider) => {
                  const isEditing = editingProviderId === provider.id && editForm !== null;
                  const isBusy = actionProviderId === provider.id;

                  return (
                    <tr key={provider.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={(event) =>
                              setEditForm((current) => (current ? { ...current, name: event.target.value } : current))
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          provider.name
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {isEditing ? (
                          <input
                            value={editForm.service}
                            onChange={(event) =>
                              setEditForm((current) =>
                                current ? { ...current, service: event.target.value } : current
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          provider.service
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p>
                          {provider.countryName} ({provider.countryCode})
                        </p>
                        <p className="text-xs text-slate-500">
                          {provider.stateName} ({provider.stateCode}) / {provider.cityName}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              value={editForm.phone}
                              onChange={(event) =>
                                setEditForm((current) => (current ? { ...current, phone: event.target.value } : current))
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                              placeholder="Telefono"
                            />
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(event) =>
                                setEditForm((current) => (current ? { ...current, email: event.target.value } : current))
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                              placeholder="Email"
                            />
                          </div>
                        ) : (
                          <>
                            <p>{provider.phone ?? '-'}</p>
                            <p className="text-xs text-slate-500">{provider.email ?? '-'}</p>
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={0.1}
                            value={editForm.rating}
                            onChange={(event) =>
                              setEditForm((current) => (current ? { ...current, rating: event.target.value } : current))
                            }
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          provider.rating.toFixed(1)
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            provider.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {provider.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">{formatDateLabel(provider.createdAt)}</td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  void handleSaveEdit(provider.id);
                                }}
                                className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={handleCancelEdit}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(actionProviderId)}
                              onClick={() => handleStartEdit(provider)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Editar
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={Boolean(actionProviderId)}
                            onClick={() => {
                              void handleToggleStatus(provider);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {provider.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Anterior
          </button>

          <span className="text-sm text-slate-600">
            Pagina {page} de {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Siguiente
          </button>
        </div>
      </article>
    </section>
  );
}
