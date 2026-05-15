// Bulk-actions context derivation — pulled out of data-table.tsx for unit
// testability. The DataTable selection bar caches the last non-zero
// context in a ref so the 200ms slide-out animation has buttons to render
// during the exit frame. This helper derives the render-time context:
//   - When selectedCount > 0: use live state. No 1-frame delay waiting
//     for useEffect to populate the ref (iter-4 regression that the
//     in-render derivation closes).
//   - When selectedCount === 0: use the cached ref (the bar is sliding
//     out; the consumer's callback still needs valid rows to render).

export interface BulkCtx<T> {
  selected: T[]
  count: number
}

export function deriveBulkCtx<T>(
  selectedRows: T[],
  selectedCount: number,
  lastNonZero: BulkCtx<T>,
): BulkCtx<T> {
  if (selectedCount > 0) return { selected: selectedRows, count: selectedCount }
  return lastNonZero
}
