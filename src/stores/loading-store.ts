import { create } from 'zustand';

interface LoadingStore {
  pendingKeys: Record<string, number>;
  startLoading: (key?: string) => void;
  stopLoading: (key?: string) => void;
  clearLoading: () => void;
}

const DEFAULT_LOADING_KEY = 'global';

const normalizeKey = (key?: string) => key?.trim() || DEFAULT_LOADING_KEY;

export const useLoadingStore = create<LoadingStore>()((set) => ({
  pendingKeys: {},
  startLoading: (key) => {
    const normalizedKey = normalizeKey(key);
    set((state) => ({
      pendingKeys: {
        ...state.pendingKeys,
        [normalizedKey]: (state.pendingKeys[normalizedKey] ?? 0) + 1,
      },
    }));
  },
  stopLoading: (key) => {
    const normalizedKey = normalizeKey(key);
    set((state) => {
      const currentValue = state.pendingKeys[normalizedKey] ?? 0;
      const nextValue = Math.max(currentValue - 1, 0);
      const nextState = { ...state.pendingKeys };

      if (nextValue === 0) {
        delete nextState[normalizedKey];
      } else {
        nextState[normalizedKey] = nextValue;
      }

      return { pendingKeys: nextState };
    });
  },
  clearLoading: () => {
    set({ pendingKeys: {} });
  },
}));
