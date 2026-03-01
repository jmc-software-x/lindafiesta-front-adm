'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useErrorStore } from '@/stores/error-store';
import { useLoadingStore } from '@/stores/loading-store';
import { useUiStore } from '@/stores/ui-store';

type QuoteTicketStatus = 'NEW' | 'IN_PROGRESS' | 'ATTENDED' | 'CLOSED';
type TicketFilterStatus = QuoteTicketStatus | 'ALL';

interface QuoteTicket {
  id: string;
  ticketCode: number;
  status: QuoteTicketStatus;
  customerFullName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerCity?: string | null;
  eventType: string;
  attendees: number;
  eventDate: string;
  budgetMin: number;
  budgetMax: number;
  createdAt: string;
}

interface CreateTicketFormState {
  customerFullName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  eventType: string;
  attendees: string;
  eventDate: string;
  budgetMin: string;
  budgetMax: string;
}

const STATUS_OPTIONS: QuoteTicketStatus[] = ['NEW', 'IN_PROGRESS', 'ATTENDED', 'CLOSED'];

const INITIAL_FORM: CreateTicketFormState = {
  customerFullName: '',
  customerPhone: '',
  customerEmail: '',
  customerCity: 'Lima',
  eventType: '',
  attendees: '',
  eventDate: '',
  budgetMin: '',
  budgetMax: '',
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

function parseTicketsPayload(payload: unknown): QuoteTicket[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter((item): item is QuoteTicket => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const record = item as Record<string, unknown>;
    return (
      typeof record.id === 'string' &&
      typeof record.ticketCode === 'number' &&
      typeof record.status === 'string' &&
      typeof record.customerFullName === 'string' &&
      typeof record.eventType === 'string'
    );
  });
}

export default function QuoteTicketsPage() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const reportError = useErrorStore((state) => state.reportError);
  const clearErrors = useErrorStore((state) => state.clearErrors);
  const startLoading = useLoadingStore((state) => state.startLoading);
  const stopLoading = useLoadingStore((state) => state.stopLoading);

  const [tickets, setTickets] = useState<QuoteTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusUpdatingTicketId, setStatusUpdatingTicketId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TicketFilterStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateTicketFormState>(INITIAL_FORM);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, QuoteTicketStatus>>({});

  const visibleTickets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return tickets;
    }

    return tickets.filter((ticket) => {
      const haystack = [
        ticket.ticketCode,
        ticket.customerFullName,
        ticket.customerPhone,
        ticket.customerEmail ?? '',
        ticket.customerCity ?? '',
        ticket.eventType,
        ticket.status,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [searchTerm, tickets]);

  const fetchTickets = async (status: TicketFilterStatus = filterStatus) => {
    setIsLoading(true);
    setLoadError(null);
    startLoading('quote-tickets.fetch');

    try {
      const query =
        status === 'ALL' ? '' : `?${new URLSearchParams({ status }).toString()}`;
      const response = await fetch(`/api/quote-tickets${query}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'No se pudo listar tickets.'));
      }

      const parsed = parseTicketsPayload(payload);
      setTickets(parsed);
      setStatusDrafts((current) => {
        const next: Record<string, QuoteTicketStatus> = { ...current };
        parsed.forEach((ticket) => {
          if (!next[ticket.id]) {
            next[ticket.id] = ticket.status;
          }
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al listar tickets.';
      setLoadError(message);
      reportError({
        source: 'api',
        message,
        details: 'GET /quote-tickets',
      });
    } finally {
      stopLoading('quote-tickets.fetch');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets(filterStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    clearErrors();
    setFormError(null);

    const attendees = Number(createForm.attendees);
    const budgetMin = Number(createForm.budgetMin);
    const budgetMax = Number(createForm.budgetMax);

    if (!Number.isFinite(attendees) || attendees < 1) {
      setFormError('attendees debe ser mayor o igual a 1.');
      return;
    }

    if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax)) {
      setFormError('budgetMin y budgetMax son obligatorios.');
      return;
    }

    if (budgetMin > budgetMax) {
      setFormError('budgetMin no puede ser mayor que budgetMax.');
      return;
    }

    setIsCreating(true);
    startLoading('quote-tickets.create');

    try {
      const payload = {
        customerFullName: createForm.customerFullName.trim(),
        customerPhone: createForm.customerPhone.trim(),
        ...(createForm.customerEmail.trim()
          ? { customerEmail: createForm.customerEmail.trim() }
          : {}),
        customerCity: createForm.customerCity.trim(),
        eventType: createForm.eventType.trim(),
        attendees,
        eventDate: createForm.eventDate,
        budgetMin,
        budgetMax,
      };

      const response = await fetch('/api/quote-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo crear ticket.'));
      }

      pushNotification({
        type: 'success',
        title: 'Ticket creado',
        message: payload.customerFullName,
      });

      setCreateForm(INITIAL_FORM);
      await fetchTickets(filterStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al crear ticket.';
      setFormError(message);
      reportError({
        source: 'api',
        message,
        details: 'POST /quote-tickets',
      });
    } finally {
      stopLoading('quote-tickets.create');
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string) => {
    if (statusUpdatingTicketId) {
      return;
    }

    const nextStatus = statusDrafts[ticketId];
    if (!nextStatus) {
      return;
    }

    setStatusUpdatingTicketId(ticketId);
    startLoading(`quote-tickets.status.${ticketId}`);

    try {
      const response = await fetch(`/api/quote-tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(extractErrorMessage(body, 'No se pudo cambiar estado del ticket.'));
      }

      pushNotification({
        type: 'success',
        title: 'Estado actualizado',
        message: nextStatus,
      });

      await fetchTickets(filterStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al cambiar estado.';
      reportError({
        source: 'api',
        message,
        details: 'PATCH /quote-tickets/:id/status',
      });
      pushNotification({
        type: 'error',
        title: 'Error al cambiar estado',
        message,
      });
    } finally {
      stopLoading(`quote-tickets.status.${ticketId}`);
      setStatusUpdatingTicketId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Tickets de cotizacion</h2>
        <p className="mt-1 text-sm text-slate-600">
          Crea solicitudes y administra su estado operativo para ventas.
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Nuevo ticket</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateTicket}>
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
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Telefono</span>
            <input
              required
              value={createForm.customerPhone}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, customerPhone: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Email (opcional)
            </span>
            <input
              type="email"
              value={createForm.customerEmail}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, customerEmail: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              placeholder="opcional"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Ciudad</span>
            <input
              required
              value={createForm.customerCity}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, customerCity: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Tipo de evento</span>
            <input
              required
              value={createForm.eventType}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, eventType: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Fecha evento</span>
            <input
              required
              type="date"
              value={createForm.eventDate}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, eventDate: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Asistentes</span>
            <input
              required
              type="number"
              min={1}
              value={createForm.attendees}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, attendees: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Budget min</span>
            <input
              required
              type="number"
              min={0}
              value={createForm.budgetMin}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, budgetMin: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Budget max</span>
            <input
              required
              type="number"
              min={0}
              value={createForm.budgetMax}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, budgetMax: event.target.value }))
              }
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
              {isCreating ? 'Creando...' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </article>

      <article className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Filtrar estado
              </span>
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as TicketFilterStatus)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
              >
                <option value="ALL">ALL</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Buscar
              </span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 md:w-72"
                placeholder="codigo, cliente, telefono..."
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              void fetchTickets(filterStatus);
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

        {visibleTickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No hay tickets para mostrar.</p>
            <p className="mt-1 text-xs text-slate-500">Crea uno nuevo o ajusta filtros.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Budget</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">#{ticket.ticketCode}</p>
                      <p className="text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{ticket.customerFullName}</p>
                      <p className="text-xs text-slate-600">{ticket.customerPhone}</p>
                      <p className="text-xs text-slate-500">{ticket.customerEmail ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{ticket.eventType}</p>
                      <p className="text-xs text-slate-600">
                        {ticket.attendees} asistentes - {ticket.customerCity ?? '-'}
                      </p>
                      <p className="text-xs text-slate-500">{ticket.eventDate}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">
                        {ticket.budgetMin} - {ticket.budgetMax}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={statusDrafts[ticket.id] ?? ticket.status}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [ticket.id]: event.target.value as QuoteTicketStatus,
                            }))
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            void handleUpdateStatus(ticket.id);
                          }}
                          disabled={statusUpdatingTicketId === ticket.id}
                          className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {statusUpdatingTicketId === ticket.id ? 'Guardando...' : 'Guardar'}
                        </button>
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
