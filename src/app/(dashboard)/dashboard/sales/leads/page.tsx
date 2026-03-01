'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { normalizeLeadPhone, onlyDigits } from '@/lib/phone';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

interface LeadRecord {
  id: string;
  status: string;
  source: string;
  customerFullName: string;
  customerPhone: string;
  customerEmail: string | null;
  eventType: string | null;
  attendees: number | null;
  createdAt: string;
}

interface CreateLeadFormState {
  customerFullName: string;
  customerPhoneCountryCode: string;
  customerPhoneNumber: string;
  source: string;
  customerEmail: string;
}

type LeadStatusFilter = 'ALL' | string;
type LeadSourceFilter = 'ALL' | string;

const PHONE_COUNTRY_OPTIONS = [
  { code: '51', label: 'Peru (+51)' },
  { code: '34', label: 'Espana (+34)' },
  { code: '52', label: 'Mexico (+52)' },
  { code: '57', label: 'Colombia (+57)' },
  { code: '58', label: 'Venezuela (+58)' },
] as const;

const INITIAL_FORM: CreateLeadFormState = {
  customerFullName: '',
  customerPhoneCountryCode: PHONE_COUNTRY_OPTIONS[0].code,
  customerPhoneNumber: '',
  source: 'DASHBOARD_ADMIN',
  customerEmail: '',
};

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message)) {
    const joined = message.filter((item) => typeof item === 'string').join(' | ');
    if (joined) {
      return joined;
    }
  }

  return fallback;
}

function parseLeadRecord(raw: unknown): LeadRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const customer =
    record.customer && typeof record.customer === 'object'
      ? (record.customer as Record<string, unknown>)
      : null;

  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) {
    return null;
  }

  const customerFullName =
    (typeof customer?.fullName === 'string' && customer.fullName) ||
    (typeof record.customerFullName === 'string' && record.customerFullName) ||
    'Sin nombre';

  const customerPhone =
    (typeof customer?.phone === 'string' && customer.phone) ||
    (typeof record.customerPhone === 'string' && record.customerPhone) ||
    '-';

  const customerEmail =
    (typeof customer?.email === 'string' && customer.email) ||
    (typeof record.customerEmail === 'string' && record.customerEmail) ||
    null;

  const eventType = typeof record.eventType === 'string' ? record.eventType : null;
  const attendees = typeof record.attendees === 'number' ? record.attendees : null;
  const source = typeof record.source === 'string' && record.source.trim() ? record.source : 'UNKNOWN';
  const status = typeof record.status === 'string' && record.status.trim() ? record.status : 'NEW';
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();

  return {
    id,
    source,
    status,
    customerFullName,
    customerPhone,
    customerEmail,
    eventType,
    attendees,
    createdAt,
  };
}

function parseLeadsPayload(payload: unknown): LeadRecord[] {
  let rawItems: unknown[] = [];

  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.data)) {
      rawItems = record.data;
    } else if (record.data && typeof record.data === 'object') {
      const nestedData = record.data as Record<string, unknown>;
      if (Array.isArray(nestedData.items)) {
        rawItems = nestedData.items;
      } else if (Array.isArray(nestedData.data)) {
        rawItems = nestedData.data;
      }
    } else if (Array.isArray(record.items)) {
      rawItems = record.items;
    }
  }

  return rawItems
    .map(parseLeadRecord)
    .filter((item): item is LeadRecord => Boolean(item));
}

export default function LeadsPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<LeadSourceFilter>('ALL');
  const [createForm, setCreateForm] = useState<CreateLeadFormState>(INITIAL_FORM);

  const statusOptions = useMemo(() => {
    return ['ALL', ...new Set(leads.map((lead) => lead.status))];
  }, [leads]);

  const sourceOptions = useMemo(() => {
    return ['ALL', ...new Set(leads.map((lead) => lead.source))];
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return leads.filter((lead) => {
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) {
        return false;
      }

      if (sourceFilter !== 'ALL' && lead.source !== sourceFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        lead.customerFullName,
        lead.customerPhone,
        lead.customerEmail ?? '',
        lead.source,
        lead.status,
        lead.eventType ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [leads, searchTerm, sourceFilter, statusFilter]);

  const fetchLeads = async () => {
    setIsLoading(true);
    setLoadError(null);
    startLoading('leads.fetch');

    try {
      const response = await fetch('/api/leads', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'No se pudo listar leads.'));
      }

      setLeads(parseLeadsPayload(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al listar leads.';
      setLoadError(message);
      reportError({
        source: 'api',
        message,
        details: 'GET /leads',
      });
    } finally {
      stopLoading('leads.fetch');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    clearErrors();
    setFormError(null);

    const customerFullName = createForm.customerFullName.trim();
    const customerPhoneCountryCode = onlyDigits(createForm.customerPhoneCountryCode);
    const customerPhoneNumber = onlyDigits(createForm.customerPhoneNumber);
    const source = createForm.source.trim().toUpperCase();
    const customerEmail = createForm.customerEmail.trim();

    if (customerFullName.length < 2) {
      setFormError('El nombre del cliente es obligatorio.');
      return;
    }

    if (!customerPhoneCountryCode) {
      setFormError('El codigo de pais es obligatorio.');
      return;
    }

    if (!customerPhoneNumber) {
      setFormError('El numero de telefono es obligatorio.');
      return;
    }

    if (!source) {
      setFormError('El source es obligatorio.');
      return;
    }

    if (customerEmail && !/^\S+@\S+\.\S+$/.test(customerEmail)) {
      setFormError('El email no es valido.');
      return;
    }

    const normalizedPhone = normalizeLeadPhone(customerPhoneCountryCode, customerPhoneNumber);
    if (!normalizedPhone.e164.startsWith('+')) {
      setFormError('No se pudo normalizar el telefono a formato internacional.');
      return;
    }

    setIsCreating(true);
    startLoading('leads.intake.create');

    try {
      const payload = {
        customerFullName,
        customerPhoneCountryCode: normalizedPhone.countryCode,
        customerPhoneNumber: normalizedPhone.nationalNumber,
        source,
        ...(customerEmail ? { customerEmail } : {}),
      };

      const response = await fetch('/api/leads/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo registrar el lead.'));
      }

      pushNotification({
        type: 'success',
        title: 'Lead registrado',
        message: `${customerFullName} - ${normalizedPhone.e164}`,
      });

      setCreateForm(INITIAL_FORM);
      await fetchLeads();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al registrar lead.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'POST /leads/intake',
      });
    } finally {
      stopLoading('leads.intake.create');
      setIsCreating(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Leads</h2>
        <p className="mt-1 text-sm text-slate-600">
          Registro manual para ventas y seguimiento de leads captados.
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Registrar lead manual</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateLead}>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</span>
            <input
              required
              value={createForm.customerFullName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, customerFullName: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Codigo pais</span>
            <select
              value={createForm.customerPhoneCountryCode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  customerPhoneCountryCode: onlyDigits(event.target.value),
                }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            >
              {PHONE_COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Telefono</span>
            <input
              required
              value={createForm.customerPhoneNumber}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  customerPhoneNumber: onlyDigits(event.target.value),
                }))
              }
              placeholder="900284446"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Source</span>
            <input
              required
              value={createForm.source}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
              placeholder="DASHBOARD_ADMIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Email (opcional)</span>
            <input
              type="email"
              value={createForm.customerEmail}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, customerEmail: event.target.value }))
              }
              placeholder="cliente@correo.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>

          <div className="md:col-span-2 xl:col-span-3">
            {formError ? (
              <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Registrando...' : 'Registrar lead'}
            </button>
          </div>
        </form>
      </article>

      <article className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Estado</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              >
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Buscar</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="cliente, telefono, source..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 md:w-80"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              void fetchLeads();
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {isLoading ? 'Actualizando...' : 'Actualizar listado'}
          </button>
        </div>

        {loadError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {visibleLeads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No hay leads para mostrar.</p>
            <p className="mt-1 text-xs text-slate-500">Registra un lead nuevo o ajusta filtros.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3 text-xs text-slate-600">{new Date(lead.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{lead.customerFullName}</p>
                      <p className="text-xs text-slate-600">{lead.customerPhone}</p>
                      <p className="text-xs text-slate-500">{lead.customerEmail ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{lead.eventType ?? '-'}</p>
                      <p className="text-xs text-slate-500">
                        {lead.attendees !== null ? `${lead.attendees} asistentes` : '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{lead.source}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {lead.status}
                      </span>
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
