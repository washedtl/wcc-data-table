// src/lib/globalColVis.ts
//
// Cross-table column visibility sync. Toggling "Profit" in SAS batch also
// toggles it in Keepa batch (and any other DataTable that opts in).
//
// Keyed by column LABEL — not ID — because the same semantic column may have
// different IDs across tables (SAS: `buy`, Keepa: `buyPrice`, both labelled "Buy").
//
// Persisted in localStorage so preferences survive reloads. The DataTable
// opt-in flag `syncColumnsByLabel` enables this behavior per table.

const STORAGE_KEY = 'boxedup.globalColVis.v1'

type VisMap = Record<string, boolean>
type Listener = (map: VisMap) => void

let state: VisMap = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) return JSON.parse(raw) as VisMap
  } catch { /* ignore */ }
  return {}
})()

const listeners = new Set<Listener>()

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export function getGlobalVis(): VisMap { return state }

/** Set the global visibility for a column label (and broadcast). */
export function setGlobalVisByLabel(label: string, visible: boolean) {
  if (!label) return
  if (state[label] === visible) return
  state = { ...state, [label]: visible }
  persist()
  for (const l of listeners) l(state)
}

/** Remove a set of column labels from the global cache. Used by Reset
 *  in a DataTable so that resetting one table doesn't leave stale
 *  overrides behind in the cross-table cache (otherwise opening a
 *  sibling table re-applies the cleared overrides). */
export function clearGlobalVisForLabels(labels: string[]) {
  if (!labels.length) return
  let changed = false
  const next = { ...state }
  for (const label of labels) {
    if (label in next) { delete next[label]; changed = true }
  }
  if (!changed) return
  state = next
  persist()
  for (const l of listeners) l(state)
}

/** Subscribe; fn is called whenever the map changes. Returns unsubscribe. */
export function subscribeGlobalVis(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Given a DataTable's columns + a visibility state (columnVisibility by ID),
 *  apply any overrides from the global map for matching labels. */
export function applyGlobalVisOverrides(
  labelById: Record<string, string>,
  current: Record<string, boolean>,
): Record<string, boolean> {
  const next: Record<string, boolean> = { ...current }
  for (const [colId, label] of Object.entries(labelById)) {
    if (label in state) next[colId] = state[label]
  }
  return next
}
