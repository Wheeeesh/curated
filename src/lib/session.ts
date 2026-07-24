import { create } from 'zustand'
import type { Category, Session } from './api/types'

export interface MapView {
  lat: number
  lng: number
  zoom: number
}

/**
 * Which slice of the atlas the map is showing: everything, only the people you
 * follow, or only the places you have saved for later.
 */
export type MapMode = 'foryou' | 'circle' | 'saved'

/** Antwerp, only as a first-run fallback before we know anything better. */
const DEFAULT_VIEW: MapView = { lat: 51.2172, lng: 4.4078, zoom: 12 }

function loadView(): MapView {
  try {
    const raw = localStorage.getItem('curated-view')
    if (raw) {
      const v = JSON.parse(raw) as MapView
      if (Number.isFinite(v.lat) && Number.isFinite(v.lng)) return v
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_VIEW
}

interface UiState {
  session: Session | null | undefined // undefined = still loading
  setSession: (s: Session | null) => void

  /** Where the map is now — persisted so the app reopens where you left it. */
  view: MapView
  setView: (v: MapView) => void
  /** Bumped to ask the map to fly somewhere; null after it has. */
  flyTo: (MapView & { nonce: number }) | null
  requestFlyTo: (v: MapView) => void

  mapMode: MapMode
  setMapMode: (m: MapMode) => void
  categoryFilters: Category[]
  toggleCategoryFilter: (c: Category) => void
  clearCategoryFilters: () => void
  toast: { id: number; message: string; gold?: boolean } | null
  showToast: (message: string, gold?: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  session: undefined,
  setSession: (s) => set({ session: s }),

  view: loadView(),
  setView: (v) => {
    localStorage.setItem('curated-view', JSON.stringify(v))
    set({ view: v })
  },
  flyTo: null,
  requestFlyTo: (v) => set({ flyTo: { ...v, nonce: Date.now() } }),

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
