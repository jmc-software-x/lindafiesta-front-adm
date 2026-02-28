import { create } from 'zustand';

export type ErrorSource = 'auth' | 'api' | 'ui' | 'unknown';

export interface AppError {
  id: string;
  source: ErrorSource;
  message: string;
  details?: string;
  createdAt: number;
}

interface ReportErrorInput {
  source?: ErrorSource;
  message: string;
  details?: string;
}

interface ErrorStore {
  errors: AppError[];
  reportError: (input: ReportErrorInput) => string;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

const MAX_ERRORS = 20;

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useErrorStore = create<ErrorStore>()((set) => ({
  errors: [],
  reportError: ({ source = 'unknown', message, details }) => {
    const id = makeId();
    const appError: AppError = {
      id,
      source,
      message,
      details,
      createdAt: Date.now(),
    };

    set((state) => ({
      errors: [appError, ...state.errors].slice(0, MAX_ERRORS),
    }));

    return id;
  },
  dismissError: (id) => {
    set((state) => ({
      errors: state.errors.filter((error) => error.id !== id),
    }));
  },
  clearErrors: () => {
    set({ errors: [] });
  },
}));
