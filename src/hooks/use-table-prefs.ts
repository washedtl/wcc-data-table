import { useEffect, useRef, useState } from 'react'
import type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  RowPinningState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'

export type TableDensity = 'compact' | 'default' | 'relaxed'

/** View-options menu state. Controls visual chrome that isn't a column-level
 *  concern — zebra, grid lines, compact row height, sticky-pin count. Saved
 *  inside TablePrefs so it round-trips with saved views and `?view=` URLs. */
export interface ViewOptions {
  /** Halve row height (88 → 40). Useful for high-density triage. */
  compact?: boolean
  /** Alternating row tint. Default true. */
  zebra?: boolean
  /** Vertical column separators (border-right on every cell). Default false. */
  gridLines?: boolean
  /** Sticky-pin the first N columns to the left. 0 = none. */
  pinFirstColumns?: number
}

export interface SavedView {
  name: string
  sizing?: ColumnSizingState
  visibility?: VisibilityState
  order?: ColumnOrderState
  sorting?: SortingState
  filters?: ColumnFiltersState
  density?: TableDensity
  viewOptions?: ViewOptions
}

export interface TablePrefs {
  sizing?: ColumnSizingState
  visibility?: VisibilityState
  order?: ColumnOrderState
  sorting?: SortingState
  filters?: ColumnFiltersState
  pinning?: RowPinningState
  density?: TableDensity
  viewOptions?: ViewOptions
  views?: SavedView[]
  activeView?: string | null
}

const KEY = (id: string) => `wcc.table.${id}`

function read(id: string): TablePrefs {
  try {
    const raw = localStorage.getItem(KEY(id))
    return raw ? (JSON.parse(raw) as TablePrefs) : {}
  } catch { return {} }
}

function write(id: string, prefs: TablePrefs) {
  try { localStorage.setItem(KEY(id), JSON.stringify(prefs)) }
  catch { /* quota or SSR — silently drop */ }
}

/** Returns the initial prefs (read once from localStorage for fast first
 *  paint) + a setter that persists the full prefs object. Callers decide
 *  which slices to persist. Writes are debounced 150ms.
 *
 *  If the URL has `?view=<encoded>` for this tableId, the encoded prefs
 *  are applied to localStorage SYNCHRONOUSLY before the initial read so
 *  the table mounts with the shared view already in place.
 *
 *  Persistence is localStorage-only — saved views live per-browser. For
 *  cross-device sync, wrap this hook in your app and mirror the storage
 *  key `wcc.table.<id>` to your backend yourself. */
export function useTablePrefs(tableId: string | undefined, defaults: TablePrefs = {}) {
  const [prefs, setPrefsState] = useState<TablePrefs>(() => {
    if (!tableId) return defaults
    applyViewFromUrl(tableId)
    return { ...defaults, ...read(tableId) }
  })

  // Debounced 150ms — column-resize fires this on every drag tick;
  // batching avoids hundreds of JSON.stringify calls during one resize.
  const localTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (!tableId) return
    if (localTimerRef.current !== null) window.clearTimeout(localTimerRef.current)
    localTimerRef.current = window.setTimeout(() => write(tableId, prefs), 150)
    return () => {
      if (localTimerRef.current !== null) window.clearTimeout(localTimerRef.current)
    }
  }, [tableId, prefs])

  return [prefs, setPrefsState] as const
}

export function clearTablePrefs(tableId: string) {
  try { localStorage.removeItem(KEY(tableId)) } catch { /* noop */ }
}

/** Encode the table prefs as a URL-safe string for sharing. Uses base64
 *  on the JSON because the resulting URLs are long anyway and base64
 *  round-trips cleanly through a query string with minimal escaping. */
export function encodeTablePrefs(prefs: TablePrefs): string {
  try {
    const json = JSON.stringify(prefs)
    // btoa requires Latin-1 — encodeURIComponent first to handle Unicode
    return btoa(unescape(encodeURIComponent(json)))
  } catch {
    return ''
  }
}

/** Decode a URL string back into TablePrefs. Returns null if malformed. */
export function decodeTablePrefs(encoded: string): TablePrefs | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    return JSON.parse(json) as TablePrefs
  } catch {
    return null
  }
}

/** Read URL ?view=<encoded> param and apply it to localStorage. Call
 *  ONCE on mount before useTablePrefs reads localStorage. Returns true
 *  if a view was applied (caller may want to clean the URL after). */
export function applyViewFromUrl(tableId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('view')
    if (!encoded) return false
    const prefs = decodeTablePrefs(encoded)
    if (!prefs) return false
    write(tableId, prefs)
    // Clean the URL — keep history clean; the view is now in localStorage
    params.delete('view')
    const cleanSearch = params.toString()
    const newUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash
    window.history.replaceState({}, '', newUrl)
    return true
  } catch { return false }
}
