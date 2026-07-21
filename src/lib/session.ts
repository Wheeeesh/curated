import { create } from 'zustand'
import type { Category, Session } from './api/types'

interface UiState {
  session: Session | null | undefined // undefined = still loading
  setSession: (s: Session | null) => void
  activeCity: string
  setActiveCity: (c: string) => void
  mapMode: 'foryou' | 'circle'
  setMapMode: (m: 'foryou' | 'circle') => void
  categoryFilters: Category[]
  toggleCategoryFilter: (c: Category) => void
  clearCategoryFilters: () => void
  toast: { id: number; message: string; gold?: boolean } | null
  showToast: (message: string, gold?: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  session: undefined,
  setSession: (s) => set({ session: s }),
  activeCity: localStorage.getItem('curated-city') ?? 'antwerp',
  setActiveCity: (c) => {
    localStorage.setItem('curated-city', c)
    set({ activeCity: c })
  },
  mapMode: 'foryou',
  setMapMode: (m) => set({ mapMode: m }),
  categoryFilters: [],
  toggleCategoryFilter: (c) =>
    set((s) => ({
      categoryFilters: s.categoryFilters.includes(c)
        ? s.categoryFilters.filter((x) => x !== c)
        : [...s.categoryFilters, c],
    })),
  clearCategoryFilters: () => set({ categoryFilters: [] }),
  toast: null,
  showToast: (message, gold) => {
    const id = Date.now()
    set({ toast: { id, message, gold } })
    setTimeout(() => {
      useUi.setState((s) => (s.toast?.id === id ? { toast: null } : {}))
    }, 3200)
  },
}))
