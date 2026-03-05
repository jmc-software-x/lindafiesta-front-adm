import { CreateProviderPayload, ProviderRecord, ProvidersListFilters } from '@/lib/providers/provider-types';

const nowIso = () => new Date().toISOString();

const INITIAL_PROVIDERS: ProviderRecord[] = [
  {
    id: 'prov-pe-001',
    name: 'Catering Imperial',
    service: 'Catering',
    countryCode: 'PE',
    countryName: 'Peru',
    stateCode: 'LMA',
    stateName: 'Lima',
    cityName: 'Lima',
    rating: 4.7,
    phone: '+51900284446',
    email: 'contacto@cateringimperial.pe',
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'prov-es-001',
    name: 'Studio Florencia',
    service: 'Decoracion',
    countryCode: 'ES',
    countryName: 'Spain',
    stateCode: 'MD',
    stateName: 'Madrid',
    cityName: 'Madrid',
    rating: 4.6,
    phone: '+34911222333',
    email: 'hola@studioflorencia.es',
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 'prov-mx-001',
    name: 'Dulce Atelier',
    service: 'Tortas',
    countryCode: 'MX',
    countryName: 'Mexico',
    stateCode: 'CMX',
    stateName: 'Ciudad de Mexico',
    cityName: 'Ciudad de Mexico',
    rating: 4.8,
    phone: '+525512345678',
    email: 'ventas@dulceatelier.mx',
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

let providersMemory: ProviderRecord[] = [...INITIAL_PROVIDERS];

function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function matchesQuery(provider: ProviderRecord, filters: ProvidersListFilters): boolean {
  const query = normalizeText(filters.q);
  if (query) {
    const haystack = [
      provider.name,
      provider.service,
      provider.countryCode,
      provider.countryName,
      provider.stateCode,
      provider.stateName,
      provider.cityName,
      provider.email || '',
      provider.phone || '',
    ]
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (filters.countryCode && provider.countryCode !== filters.countryCode) {
    return false;
  }

  if (filters.stateCode && provider.stateCode !== filters.stateCode) {
    return false;
  }

  if (filters.city && !normalizeText(provider.cityName).includes(normalizeText(filters.city))) {
    return false;
  }

  if (filters.service && !normalizeText(provider.service).includes(normalizeText(filters.service))) {
    return false;
  }

  if (!filters.includeInactive && !provider.isActive) {
    return false;
  }

  return true;
}

export function listProviders(filters: ProvidersListFilters): ProviderRecord[] {
  return providersMemory
    .filter((provider) => matchesQuery(provider, filters))
    .sort((a, b) => {
      const locationComparison = `${a.countryCode}-${a.stateCode}-${a.cityName}`.localeCompare(
        `${b.countryCode}-${b.stateCode}-${b.cityName}`,
        'es'
      );
      if (locationComparison !== 0) {
        return locationComparison;
      }

      return a.name.localeCompare(b.name, 'es');
    });
}

export function createProvider(payload: CreateProviderPayload): ProviderRecord {
  const createdAt = nowIso();
  const rating = typeof payload.rating === 'number' ? payload.rating : 4.5;

  const provider: ProviderRecord = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `prov-${Date.now()}`,
    name: payload.name.trim(),
    service: payload.service.trim(),
    countryCode: payload.countryCode.trim().toUpperCase(),
    countryName: payload.countryName.trim(),
    stateCode: payload.stateCode.trim().toUpperCase(),
    stateName: payload.stateName.trim(),
    cityName: payload.cityName.trim(),
    rating: Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 4.5)),
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    isActive: payload.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  };

  providersMemory = [provider, ...providersMemory];
  return provider;
}
