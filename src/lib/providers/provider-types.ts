export interface ProviderRecord {
  id: string;
  name: string;
  service: string;
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityName: string;
  rating: number;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderPayload {
  name: string;
  service: string;
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityName: string;
  rating?: number;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface ProvidersListFilters {
  q?: string;
  countryCode?: string;
  stateCode?: string;
  city?: string;
  service?: string;
  includeInactive?: boolean;
}

export interface ProvidersListResponse {
  items: ProviderRecord[];
  total: number;
}
