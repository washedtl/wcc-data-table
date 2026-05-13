import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type Header,
  type Row,
  type RowPinningState,
  type RowSelectionState,
  type SortingState,
  type Table as TanTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'

import { cn } from '@/lib/cn'
import { applyGlobalVisOverrides, clearGlobalVisForLabels, setGlobalVisByLabel, subscribeGlobalVis } from '@/hooks/cross-table-vis'
import { EmptyState } from '@/components/ui/empty-state'
import { FindBar } from '@/components/find-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import type { CheckboxProps } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Sparkline, type SparklineTone } from '@/components/ui/sparkline'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  IcoFilter,
  IcoChevronDown,
  IcoClose,
  IcoPlus,
  IcoPin,
  IcoPinOff,
  IcoGripVertical,
  IcoColumns,
  IcoBookmark,
  IcoRotateCw,
  IcoRotateCcw,
  IcoEye,
  IcoLink,
  IcoMoreH,
} from '@/lib/icons'
import { useTablePrefs, encodeTablePrefs, type TableDensity, type SavedView, type ViewOptions } from '@/hooks/use-table-prefs'

/* ═══════════════════════════════════════════════════════════════════
   Cell tone + StatusChip helpers
   ═══════════════════════════════════════════════════════════════════ */

/** Column-level cell tone — read from `meta.tone` on column defs.
 *  - `numeric`  → right-aligned + tabular-nums (header + cells)
 *  - `positive` / `negative` → reserved for future color treatments
 */
export type ColumnTone = 'numeric' | 'positive' | 'negative' | 'center'

export type StatusChipTone = 'positive' | 'warning' | 'negative' | 'info' | 'muted'

export interface StatusChipProps {
  label: string
  tone: StatusChipTone
}

/** Tiny status pill — used for table status columns (Done/Pending/Failed/etc). */
export function StatusChip({ label, tone }: StatusChipProps): JSX.Element {
  const styles: Record<StatusChipTone, { background: string; color: string }> = {
    positive: {
      background: 'color-mix(in srgb, var(--positive) 15%, transparent)',
      color: 'var(--positive)',
    },
    warning: {
      background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
      color: 'var(--warning)',
    },
    negative: {
      background: 'color-mix(in srgb, var(--negative) 15%, transparent)',
      color: 'var(--negative)',
    },
    info: {
      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
      color: 'var(--accent)',
    },
    muted: {
      background: 'var(--surface-2)',
      color: 'var(--text-dim)',
    },
  }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.05em]"
      style={styles[tone]}
    >
      {label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Column helpers
   ═══════════════════════════════════════════════════════════════════ */

/** Row-selection checkbox column — prepend to any columns[]. */
export function selectColumn<T>(
  color: CheckboxProps['color'] = 'accent',
  options?: { enableShiftRangeSelect?: boolean }
): ColumnDef<T, unknown> {
  const enableShiftRange = options?.enableShiftRangeSelect ?? false
  // Closure-scoped — shared across every cell of this column. Tracks the last
  // checkbox the user clicked WITHOUT shift so a subsequent shift-click can
  // toggle the contiguous range between the two. One ref per selectColumn()
  // call, which is one per table — perfect.
  const lastClickedRowId: { current: string | null } = { current: null }
  return {
    id: '__select',
    header: ({ table }) => (
      <Checkbox
        color={color}
        size="sm"
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row, table }) => (
      <Checkbox
        color={color}
        size="sm"
        checked={row.getIsSelected()}
        // Skip onCheckedChange — we handle every selection mutation in onClick
        // so we can read e.shiftKey and override the toggle for range select.
        // The `checked` prop keeps Radix in controlled mode; it won't try to
        // flip state on its own when onCheckedChange is omitted.
        aria-label="Select row"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (
            enableShiftRange &&
            (e as unknown as MouseEvent).shiftKey &&
            lastClickedRowId.current &&
            lastClickedRowId.current !== row.id
          ) {
            const rows = table.getRowModel().rows
            const lastIdx = rows.findIndex((r) => r.id === lastClickedRowId.current)
            const curIdx = rows.findIndex((r) => r.id === row.id)
            if (lastIdx >= 0 && curIdx >= 0) {
              const [a, b] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
              // Target state = the OPPOSITE of the row that was just clicked.
              // If user shift-clicks an unselected row, the whole range becomes
              // selected; if they shift-click a selected row, the range clears.
              const targetState = !row.getIsSelected()
              for (let i = a; i <= b; i++) {
                if (rows[i].getIsSelected() !== targetState) rows[i].toggleSelected(targetState)
              }
              return
            }
          }
          row.toggleSelected()
          lastClickedRowId.current = row.id
        }}
      />
    ),
    size: 32,
    minSize: 32,
    maxSize: 40,
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
  }
}

/** Pin-row column — tiny pin icon that toggles row-pin state.
 *
 *  Header doubles as "clear all pins" affordance: when 1+ rows are pinned
 *  it becomes a clickable button showing the pinned count. Without this,
 *  pinned rows accumulated across sessions (persisted via tableId in
 *  prefs.pinning) had no bulk-clear path — the user would have to click
 *  every pinned row's icon individually to unpin. */
export function pinColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: '__pin',
    header: ({ table }) => {
      const topPinned = table.getState().rowPinning?.top || []
      const pinnedCount = topPinned.length
      if (pinnedCount === 0) {
        return (
          <span aria-label="Pin" title="Pin rows — click any row's pin icon to keep it at the top" className="inline-flex items-center justify-center w-5 h-5 text-[var(--text-muted)]">
            <IcoPin size={12} />
          </span>
        )
      }
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            table.setRowPinning({ top: [], bottom: [] })
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center gap-0.5 h-5 px-1 rounded text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
          title={`Clear ${pinnedCount} pinned row${pinnedCount === 1 ? '' : 's'}`}
          aria-label={`Clear ${pinnedCount} pinned row${pinnedCount === 1 ? '' : 's'}`}
        >
          <IcoPinOff size={12} />
          <span className="mono text-[9.5px] font-semibold leading-none">{pinnedCount}</span>
        </button>
      )
    },
    cell: ({ row }) => {
      const pinned = row.getIsPinned()
      return (
        // The wrapping span swallows clicks anywhere in the pin TD so misses
        // around the small 20×20 button never bubble up to the row click
        // handler (which would open the detail drawer or — with shift held —
        // start a range selection). Without this, dragging through the pin
        // column area while reviewing a long list could accidentally select
        // every row in the range.
        <span onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              row.pin(pinned ? false : 'top')
            }}
            className={cn(
              'inline-flex items-center justify-center w-5 h-5 rounded transition-colors',
              pinned
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)] opacity-0 group-hover/row:opacity-100 hover:text-[var(--text-dim)]'
            )}
            title={pinned ? 'Unpin row' : 'Pin row to top'}
            aria-pressed={!!pinned}
          >
            {pinned ? <IcoPinOff size={12} /> : <IcoPin size={12} />}
          </button>
        </span>
      )
    },
    size: 32,
    minSize: 28,
    maxSize: 40,
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
  }
}

/** Sparkline column — renders a tone-colored svg polyline from an
 *  array accessor on the row. Width/height default to 60×18. */
export function sparkColumn<T>(opts: {
  id: string
  header: string
  accessor: (row: T) => number[]
  tone?: SparklineTone | ((row: T) => SparklineTone)
  width?: number
  height?: number
  size?: number
  /** Polyline stroke width — Sparkline default is 1.4 (very thin). Bump to ~2
   *  for tables that use spark as a primary visual cue (FlipAlert). */
  strokeWidth?: number
}): ColumnDef<T, unknown> {
  const { id, header, accessor, tone = 'info', width = 60, height = 18, size = 80, strokeWidth } = opts
  return {
    id,
    header,
    size,
    enableSorting: false,
    cell: ({ row }) => {
      const values = accessor(row.original)
      const resolvedTone = typeof tone === 'function' ? tone(row.original) : tone
      return <Sparkline values={values} tone={resolvedTone} width={width} height={height} strokeWidth={strokeWidth} />
    },
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Density + virtualization config
   ═══════════════════════════════════════════════════════════════════ */

const VIRTUAL_THRESHOLD = 200

// Roomy ("relaxed") gets a real lift: bigger vertical padding, larger body
// font, and an extra 1px on horizontal cell padding (overrides the cell's
// own baseline `px-3` because Tailwind picks the last conflicting class).
// Three densities that *feel* meaningfully different — Tight for the
// operator scanning thousands of rows, Auto as the daily driver, Roomy
// for working through a small set of high-attention rows.
const DENSITY_CLASS: Record<TableDensity, { row: string; header: string }> = {
  compact: { row: 'py-1.5 text-[11.5px]',          header: 'py-1.5 text-[9.5px]'    },
  default: { row: 'py-2 text-[12px]',              header: 'py-2 text-[10px]'       },
  relaxed: { row: 'py-3.5 px-4 text-[13px]',       header: 'py-3 px-4 text-[10.5px]' },
}

// Row heights MUST accommodate the tallest cell content actually rendered.
// 22px ProductCell thumb + 12px py-1.5 padding (compact) = 34px minimum →
// row height 32 left ~4-8px overflow per row, which the virtualizer's
// fixed translateY positioning visually stacked into the next slot
// (KPF Product column was the canonical bug: titles from row N+1 painted
// over the bottom of row N's title across hundreds of rows).
// 38 gives 4px breathing room above 34 and stays visibly tighter than
// the 40 default. If a future cell needs more, bump again or add
// `overflow: hidden` on the td to clip rather than bleed.
const DENSITY_ROW_H: Record<TableDensity, number> = {
  compact: 38, default: 44, relaxed: 64,
}

/* ═══════════════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════════════ */

export interface BulkActionCtx<T> {
  selected: T[]
  count: number
  clear: () => void
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  rowKey: (row: T) => string
  loading?: boolean
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  emptyState?: ReactNode
  globalFilterPlaceholder?: string
  className?: string
  estimateRowHeight?: number
  maxHeight?: number
  tableId?: string
  defaultDensity?: TableDensity
  density?: TableDensity
  showColumnMenu?: boolean
  showDensityToggle?: boolean
  showGlobalFilter?: boolean
  showViewsMenu?: boolean
  /** Render the View dropdown (compact/zebra/grid-lines/pin-cols/copy-url) in
   *  the toolbar. The toggle states are persisted in `prefs.viewOptions` and
   *  round-trip with saved views. Default true. */
  showViewOptions?: boolean
  /** Optional menu items rendered inside a "More" dropdown trigger in the
   *  toolbar. Use `<DropdownMenuItem>`, `<DropdownMenuLabel>`, etc. — same
   *  primitives saved views uses. Pass any consumer-specific refresh /
   *  export / clear / undo actions. When omitted, the trigger is hidden. */
  moreActions?: ReactNode
  /** Tailwind classes applied to the More trigger button. Use `"2xl:hidden"`
   *  (default) to hide on wide screens where the consumer renders individual
   *  buttons via the `toolbar` prop. Pass `""` for always-visible. */
  moreActionsClassName?: string
  /** Optional callback fired when any View-menu toggle changes. Useful when
   *  the consumer needs to mirror a toggle to its own state (e.g. a `compact`
   *  toggle that drives a column rebuild). Payload is a partial — only the
   *  changed field is set. */
  onViewOptionsChange?: (next: Partial<ViewOptions>) => void
  bulkActions?: (ctx: BulkActionCtx<T>) => ReactNode
  /** When provided, clicking a row opens a right-side Sheet drawer
   *  rendering the returned node. Overrides onRowClick. */
  detailRenderer?: (row: T) => {
    title?: ReactNode
    description?: ReactNode
    content: ReactNode
  }
  /** Enable drag-to-reorder on column headers. Default true. */
  enableColumnReorder?: boolean
  /** Enable per-column filter popovers. Default true. */
  enableColumnFilters?: boolean
  /** Enable row pinning (needs pinColumn() in columns). Default true. */
  enableRowPinning?: boolean
  /** When true, column visibility is synced across every table that also opts in,
   *  keyed by column LABEL (so "Buy" hides in both SAS and Keepa). */
  syncColumnsByLabel?: boolean
  /** Per-column visibility overrides applied on mount + whenever the table is
   *  re-keyed. Lets callers force certain columns visible/hidden when the
   *  surrounding context demands it (e.g. FlipAlert's "Triggered" tab forcing
   *  `current` + `delta` on, even though they're `defaultHidden` on other tabs).
   *  Wins over `meta.defaultHidden`; loses to a saved view in `prefs`. */
  defaultColumnVisibility?: VisibilityState
  /** Optional per-row className resolver — return a class string to apply to
   *  the <tr>. Used for status-driven row accents (e.g. FA's triggered-row
   *  left-border highlight) without leaking that styling into other tables. */
  rowClassName?: (row: T) => string | null | undefined
  /** When true, the table fills its parent's flex space instead of being
   *  constrained by `maxHeight`. The parent must be a flex container with a
   *  bounded height (e.g. `flex flex-col h-full`) for this to compute. Useful
   *  for full-screen tables (FA's 2.7K-row alert list) where a 560px cap
   *  leaves the bottom 40% of the viewport empty. */
  fillHeight?: boolean
  /** Render thin vertical rules between every column (Keepa-style). Adds
   *  `border-r border-[var(--border)]` to all but the last visible cell in
   *  each row + header. Off by default — opt in per-table for spreadsheet
   *  density without affecting the rest of the app. */
  verticalRules?: boolean
  /** Zebra stripe odd rows. Subtle by default; toggle off for a flat
   *  body. Default true. */
  zebra?: boolean
  /** Bump the column-header padding to `py-3` regardless of density.
   *  Useful when the column titles need more vertical room as click
   *  targets (sort indicator + drag handle + filter trigger) without
   *  shifting the rest of the density rhythm. Off by default. */
  tallHeader?: boolean
  /** Visually "lift" the DataTable internal toolbar + column-header thead by
   *  giving them a --surface-2 background. Useful when the table sits inside
   *  a region whose body is darker than --surface (e.g. the SAS batch card,
   *  which scopes --surface→--bg on the table region) — without this the
   *  chrome blends into the body. Off by default. */
  liftedHeader?: boolean
  /** Escape hatch for caller-defined keyboard commands. Fires for keys
   *  DataTable doesn't handle itself; the caller can read `cmd` (a stable
   *  string identifier) and act on the focused row / visible rows. Used by
   *  SAS batch for "f" (jump to next strong lead), "F" (cycle filter
   *  preset), and "o"/"O" (open Amazon / Single-ASIN view). */
  onKeyboardCommand?: (
    cmd: string,
    ctx: {
      focusedRow: T | null
      focusedIndex: number | null
      visibleRows: T[]
      setFocusedIndex: (i: number | null) => void
      e: React.KeyboardEvent<HTMLDivElement>
    }
  ) => void
  /** Double-click handler — fires regardless of selection state, so the
   *  user can drill into a row even when in multi-select mode. Caller
   *  decides whether to open detail / modal / etc. If undefined, double-click
   *  falls through to the regular onRowClick path. */
  onRowDoubleClick?: (row: T) => void
  /** Middle-click (mouse button 1, "wheel click") handler. Typically used
   *  to open a row's full detail in a new browser tab without leaving the
   *  current view. Caller computes the URL. */
  onRowMiddleClick?: (row: T) => void
  /** Pin the first N visible columns to the left edge of the scroll container.
   *  Uses pure CSS `position: sticky`. The N includes admin columns (select,
   *  pin), so pass a count that covers everything you want anchored. The last
   *  sticky cell gets a right-edge shadow so the boundary is visible.
   *  Default 0 (off). */
  stickyLeftCount?: number
  /** Cmd+F summons a floating find-bar overlay (FindBar component) anchored to
   *  the bottom-right of the table. The bar's query feeds the same globalFilter
   *  state as the inline filter input, so both UIs are equivalent — the find-bar
   *  is the keyboard-driven path. The bar shows N of M match counts and ↑↓
   *  buttons that move the j/k cursor between matches. Default true. */
  findBarEnabled?: boolean
  /** Per-row right-click context menu. Called once per visible row; returns the
   *  ContextMenuContent JSX (the items inside `<ContextMenuContent>`). DataTable
   *  wraps the `<tr>` in `<ContextMenuTrigger asChild>` and portals the content
   *  through Radix. The ctx exposes whether the right-clicked row is part of an
   *  active multi-select so callers can act on the selection or just the row.
   *  Single-row-only actions (open links, edit a single field) should hide
   *  themselves when `selected.length > 1`. */
  rowContextMenu?: (ctx: RowContextMenuCtx<T>) => ReactNode
  /** Optional notification sink. Called for transient user feedback (e.g.
   *  "Copied N IDs" after Ctrl+C on a selection). Wire to your toast lib
   *  (sonner, react-hot-toast, etc.) or a custom snackbar. If omitted,
   *  feedback is silently dropped. */
  onNotify?: (message: string, kind: 'success' | 'error' | 'info') => void
}

export interface RowContextMenuCtx<T> {
  row: T
  /** Rows currently checkbox-selected. If `isInSelection` is true these are
   *  what the menu should act on; otherwise act on `[row]` only. */
  selected: T[]
  /** True when the right-clicked row is part of the current selection. */
  isInSelection: boolean
  /** Clear all checkbox selection — useful after destructive bulk actions. */
  clearSelection: () => void
}

/* ═══════════════════════════════════════════════════════════════════
   DataTable
   ═══════════════════════════════════════════════════════════════════ */

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  onRowClick,
  toolbar,
  emptyState,
  globalFilterPlaceholder = 'Filter…',
  className,
  estimateRowHeight,
  maxHeight = 560,
  tableId,
  defaultDensity = 'default',
  density: densityProp,
  showColumnMenu = true,
  showDensityToggle = true,
  showGlobalFilter = true,
  showViewsMenu = true,
  showViewOptions = true,
  moreActions,
  moreActionsClassName = '2xl:hidden',
  onViewOptionsChange,
  bulkActions,
  detailRenderer,
  enableColumnReorder = true,
  enableColumnFilters = true,
  enableRowPinning = true,
  syncColumnsByLabel = false,
  defaultColumnVisibility,
  fillHeight = false,
  rowClassName,
  verticalRules = false,
  zebra = true,
  tallHeader = false,
  liftedHeader = false,
  stickyLeftCount = 0,
  rowContextMenu,
  onKeyboardCommand,
  onRowDoubleClick,
  onRowMiddleClick,
  findBarEnabled = true,
  onNotify,
}: DataTableProps<T>) {
  const initialOrder = useMemo(
    () => columns.map((c, i) => c.id ?? `__col_${i}`) as ColumnOrderState,
    [columns]
  )

  const [prefs, setPrefs] = useTablePrefs(tableId, {
    sizing: {},
    visibility: {},
    order: initialOrder,
    sorting: [],
    filters: [],
    pinning: { top: [], bottom: [] },
    density: defaultDensity,
    views: [],
    activeView: null,
  })

  const [sorting, setSorting] = useState<SortingState>(prefs.sorting ?? [])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(prefs.filters ?? [])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(prefs.sizing ?? {})
  // Seed visibility in this priority order (highest wins):
  //   1. caller-supplied `defaultColumnVisibility` (FA's "Triggered tab forces
  //      current + delta on" lives here — must win even if the user has prior
  //      saved prefs from a previous tab session)
  //   2. saved user prefs (`prefs.visibility`) — the user's choices on this
  //      tableId persist across mounts
  //   3. `meta.defaultHidden` on column defs — initial off-by-default columns
  // Earlier code returned prefs.visibility wholesale when non-empty, which
  // silently dropped the caller's force-on overrides on second mount. Now
  // they merge: prefs supplies the user's chosen visibility for keys NOT in
  // defaultColumnVisibility; defaults overlay on top.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const seed: VisibilityState = {}
    for (const c of columns) {
      const meta = (c as ColumnDef<T, unknown> & { meta?: { defaultHidden?: boolean } }).meta
      const id = (c as ColumnDef<T, unknown> & { id?: string }).id
      if (meta?.defaultHidden && id) seed[id] = false
    }
    if (prefs.visibility && Object.keys(prefs.visibility).length) {
      for (const [id, vis] of Object.entries(prefs.visibility)) seed[id] = vis
    }
    if (defaultColumnVisibility) {
      for (const [id, vis] of Object.entries(defaultColumnVisibility)) seed[id] = vis
    }
    return seed
  })
  // Re-apply caller-supplied `defaultColumnVisibility` overrides whenever the
  // prop changes (e.g. FA's "Triggered" tab forces current+delta on without
  // a remount). The lazy useState init only runs once at mount, so a parent
  // changing the prop AFTER mount would otherwise be silently ignored.
  // Stringify to avoid re-firing on every render with a fresh-reference
  // object literal.
  const defaultColumnVisibilityKey = defaultColumnVisibility
    ? JSON.stringify(defaultColumnVisibility)
    : ''
  useEffect(() => {
    if (!defaultColumnVisibility) return
    setColumnVisibility(curr => {
      const next: VisibilityState = { ...curr }
      let changed = false
      for (const [id, vis] of Object.entries(defaultColumnVisibility)) {
        if (next[id] !== vis) { next[id] = vis; changed = true }
      }
      return changed ? next : curr
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColumnVisibilityKey])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(prefs.order ?? initialOrder)
  // Bulk-visibility-suppress flag — set by Show all / Hide all / Reset
  // before mutating columnVisibility, read inside onColumnVisibilityChange
  // to skip the cross-table globalColVis broadcast. Without this, clicking
  // "Hide all" on one table broadcasts 44 individual `false` toggles to
  // every other syncColumnsByLabel-table, durably poisoning shared state.
  // The flag is consumed (set back to false) on the same change cycle.
  const suppressVisBroadcastRef = useRef(false)
  // Row pinning is intentionally NOT restored from localStorage. Persisting
  // it across sessions caused two failure modes:
  //   1. Stale row IDs from a previous data shape made TanStack's getRow()
  //      throw inside _getPinnedRows, crashing the entire panel render
  //      with "doesn't load" symptoms.
  //   2. Even with valid IDs, accumulated pinned rows pushed the
  //      virtualized centerRow translateY offscreen.
  // Pinning is a scratch tool for the current viewing session — start empty
  // every mount. If a user wants persistent prioritization, that's what
  // sorting + saved views are for.
  const [rowPinning, setRowPinning] = useState<RowPinningState>({ top: [], bottom: [] })
  // Prune orphaned row-selection entries whenever `data` shrinks (e.g. parent
  // pageSize cap, a filter that drops rows, or a destructive row removal).
  // Without this, IDs that disappear from `data` stay in rowSelection
  // indefinitely — `getSelectedRowModel().rows` quietly drops them (so
  // bulk-action count reads 0 and the bar disappears), but the selection
  // state lingers and re-activates if the rows come back later. Pruning
  // keeps "what's selected" and "what bulk-actions can reach" in sync.
  useEffect(() => {
    const keys = Object.keys(rowSelection)
    if (keys.length === 0) return
    const ids = new Set(data.map(r => rowKey(r)))
    let hasOrphans = false
    for (const k of keys) {
      if (!ids.has(k)) { hasOrphans = true; break }
    }
    if (!hasOrphans) return
    setRowSelection(prev => {
      const next: RowSelectionState = {}
      for (const k of Object.keys(prev)) {
        if (ids.has(k)) next[k] = prev[k]
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  // Defensive: if localStorage already has corrupted pinning state from an
  // older build, clear it on mount so it doesn't sit there forever.
  const clearedStaleRef = useRef(false)
  useEffect(() => {
    if (clearedStaleRef.current) return
    clearedStaleRef.current = true
    if (prefs.pinning && ((prefs.pinning.top?.length ?? 0) > 0 || (prefs.pinning.bottom?.length ?? 0) > 0)) {
      setPrefs((p) => ({ ...p, pinning: { top: [], bottom: [] } }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const density = densityProp ?? prefs.density ?? defaultDensity
  const [detailRow, setDetailRow] = useState<T | null>(null)
  // FindBar — opened via Cmd+F; feeds the same globalFilter as the inline input.
  // Kept as local state so each table opens/closes its own bar independently.
  const [findBarOpen, setFindBarOpen] = useState(false)

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting, globalFilter, columnFilters, rowSelection,
      columnSizing, columnVisibility, columnOrder, rowPinning,
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableRowPinning,
    keepPinnedRows: true,
    onSortingChange: (u) => {
      const next = typeof u === 'function' ? u(sorting) : u
      setSorting(next)
      setPrefs((p) => ({ ...p, sorting: next }))
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: (u) => {
      const next = typeof u === 'function' ? u(columnFilters) : u
      setColumnFilters(next)
      setPrefs((p) => ({ ...p, filters: next }))
    },
    onRowSelectionChange: setRowSelection,
    onRowPinningChange: (u) => {
      const next = typeof u === 'function' ? u(rowPinning) : u
      setRowPinning(next)
      setPrefs((p) => ({ ...p, pinning: next }))
    },
    onColumnSizingChange: (u) => {
      const next = typeof u === 'function' ? u(columnSizing) : u
      setColumnSizing(next)
      setPrefs((p) => ({ ...p, sizing: next }))
    },
    onColumnVisibilityChange: (u) => {
      const next = typeof u === 'function' ? u(columnVisibility) : u
      setColumnVisibility(next)
      setPrefs((p) => ({ ...p, visibility: next }))
      // Cross-table sync: broadcast toggles keyed by column LABEL so sibling
      // tables update in lock-step. Suppressed during bulk operations
      // (Show all / Hide all / Reset) — those are local-only intent
      // and broadcasting 44 entries would poison every sibling table.
      if (syncColumnsByLabel && !suppressVisBroadcastRef.current) {
        const diff = diffVisibility(columnVisibility, next)
        for (const { id, visible } of diff) {
          const col = table.getColumn(id)
          const headerDef = col?.columnDef.header
          const label = typeof headerDef === 'string' ? headerDef : id
          setGlobalVisByLabel(label, visible)
        }
      }
      // Consume the suppression flag — it covers exactly one change cycle.
      suppressVisBroadcastRef.current = false
    },
    onColumnOrderChange: (u) => {
      const next = typeof u === 'function' ? u(columnOrder) : u
      setColumnOrder(next)
      setPrefs((p) => ({ ...p, order: next }))
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => rowKey(row as T),
  })

  const rows = table.getRowModel().rows
  const topPinnedRows = enableRowPinning ? table.getTopRows() : []
  const centerRows = enableRowPinning ? table.getCenterRows() : rows
  const shouldVirtualize = centerRows.length >= VIRTUAL_THRESHOLD
  // (focusedRowId derivation moved AFTER the focusedRowIndex useState
  // below — see "Keyboard-nav cursor" block.)

  // Small utility: diff two visibility maps so we can broadcast only real changes.
  function diffVisibility(prev: VisibilityState, next: VisibilityState): Array<{ id: string; visible: boolean }> {
    const out: Array<{ id: string; visible: boolean }> = []
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])
    for (const k of allKeys) {
      const a = prev[k] ?? true
      const b = next[k] ?? true
      if (a !== b) out.push({ id: k, visible: b })
    }
    return out
  }

  // View options (compact / zebra / grid-lines / pin-cols) — prefs.viewOptions
  // is the durable source-of-truth (persisted localStorage, round-trips with
  // saved views). Props are the initial defaults at first mount. Once the user
  // toggles anything in the View menu, prefs wins. Without prefs set, the
  // declarative props at the call site are honored.
  const effectiveZebra = prefs.viewOptions?.zebra ?? zebra
  const effectiveGridLines = prefs.viewOptions?.gridLines ?? verticalRules
  const effectivePinCount = prefs.viewOptions?.pinFirstColumns ?? stickyLeftCount
  const effectiveCompact = prefs.viewOptions?.compact ?? false
  const rowHeight = estimateRowHeight ?? (effectiveCompact ? 40 : DENSITY_ROW_H[density])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const filterInputRef = useRef<HTMLInputElement | null>(null)
  // ── Keyboard-nav cursor ──
  // Tracks which visible row currently has the keyboard cursor. j/k move it,
  // Enter opens (via onRowClick), x toggles its checkbox, / focuses the filter.
  // Index is into the CURRENT sorted/filtered row order — it's resolved at
  // handler-time so it stays correct as filters change.
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)
  // Derive the focused row's stable id from the keyboard cursor index.
  // The keyboard handler operates on `table.getRowModel().rows` (which
  // includes pinned rows in their sorted position), but the body iterates
  // `centerRows` (which excludes pinned rows when pinning is enabled).
  // Comparing by index would mean a focused pinned row never gets the
  // accent stripe on the rendered side. Resolving to an id once here lets
  // both pinned + center BodyRow instances do an O(1) match.
  const focusedRowId = focusedRowIndex != null
    ? rows[focusedRowIndex]?.id ?? null
    : null
  // S4 — when the data shrinks (row removal), clamp the cursor so it stays
  // on a valid index. Without this the cursor "lingers" past the array end
  // and pressing j/k from there would jump unexpectedly.
  useEffect(() => {
    if (focusedRowIndex == null) return
    if (focusedRowIndex >= data.length) {
      setFocusedRowIndex(data.length > 0 ? data.length - 1 : null)
    }
  }, [data.length, focusedRowIndex])
  // When the filter changes, the row set narrows — drop the cursor so the
  // next FindBar ↓ press lands on match #1 instead of an out-of-range index
  // that fell off the end of the filtered range.
  useEffect(() => {
    setFocusedRowIndex(null)
  }, [globalFilter])
  // Shift-click anchor: the last row whose selection was toggled explicitly.
  const lastSelectedIdRef = useRef<string | null>(null)
  // Move the keyboard focus cursor and scroll the new row into view on
  // the next frame (after React commits the data-focused attribute).
  // Used by both the keydown handler and the FindBar ↑↓ buttons so the
  // two paths stay in sync. Caller is responsible for clamping the index.
  const moveFocusTo = (idx: number) => {
    setFocusedRowIndex(idx)
    requestAnimationFrame(() => {
      rootRef.current?.querySelector('[data-focused="true"]')
        ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    })
  }
  const rowVirtualizer = useVirtualizer({
    count: centerRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    enabled: shouldVirtualize,
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []
  const totalHeight = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0

  const headerCells = useMemo(
    () => table.getHeaderGroups().flatMap((hg) => hg.headers),
    [table]
  )
  const densityClass = DENSITY_CLASS[density]

  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    [table, rowSelection] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const selectedCount = selectedRows.length
  const clearSelection = () => table.resetRowSelection()

  // Per-row context-menu content factory. Computes the selection-aware ctx —
  // when the right-clicked row IS part of the active multi-select, the menu
  // acts on the whole selection; otherwise it acts on just that row and does
  // NOT mutate selection (Linear/Figma semantics). Returns null when the
  // caller didn't opt into right-click, so BodyRow renders the bare <tr>.
  const buildRowContextMenu = (row: Row<T>): ReactNode => {
    if (!rowContextMenu) return null
    const isInSelection = row.getIsSelected()
    const selected = isInSelection ? (selectedRows as T[]) : [row.original as T]
    return rowContextMenu({
      row: row.original as T,
      selected,
      isInSelection,
      clearSelection,
    })
  }

  // ── Column reorder via @dnd-kit ──
  // 3px activation — tight enough that a real drag triggers immediately while
  // still distinguishing clicks from drags.
  // 8px activation distance: forgiving for plain clicks (sort, filter) while
  // still snappy for an intentional drag. 3px was too tight — slight pointer
  // jitter on a click was activating drag.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  // Drag state — used to render the DragOverlay ghost while a column header is
  // being moved. Without the overlay, dnd-kit's transform only affects the
  // dragged <th> in-place, which was visually hard to read (user thought drag
  // was "broken" when the header moved back on release).
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const activeDragHeader = useMemo(() => {
    if (!activeDragId) return null
    return table.getFlatHeaders().find(h => h.id === activeDragId) ?? null
  }, [activeDragId, table])

  // Subscribe to the cross-table visibility bus (if opted in). Inbound changes
  // are applied to this table's visibility state without rebroadcasting.
  useEffect(() => {
    if (!syncColumnsByLabel) return
    const applyFromGlobal = () => {
      const labelById: Record<string, string> = {}
      for (const col of table.getAllLeafColumns()) {
        const h = col.columnDef.header
        labelById[col.id] = typeof h === 'string' ? h : col.id
      }
      setColumnVisibility(prev => applyGlobalVisOverrides(labelById, prev))
    }
    applyFromGlobal()
    return subscribeGlobalVis(applyFromGlobal)
  }, [syncColumnsByLabel, table])

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const currentOrder = (columnOrder.length ? columnOrder : initialOrder).slice()
    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(currentOrder, oldIndex, newIndex)
    setColumnOrder(next)
    setPrefs((p) => ({ ...p, order: next }))
  }
  const handleDragCancel = () => setActiveDragId(null)

  // Row click behavior:
  //  - plain click (no selection)   → open detail drawer / onRowClick
  //  - plain click (selection active)→ toggle this row's selection (Linear/Gmail-
  //                                    style multi-select; modal stays closed
  //                                    until the user clears selection with Esc)
  //  - Ctrl/Cmd + click               → always toggle this row's selection
  //  - Shift + click                  → range-select from last anchor to this row
  const handleRowClick = (row: T, e?: React.MouseEvent) => {
    const tableRow = table.getRowModel().rowsById[rowKey(row)]
    if (e && (e.ctrlKey || e.metaKey) && tableRow) {
      tableRow.toggleSelected()
      lastSelectedIdRef.current = tableRow.id
      return
    }
    if (e && e.shiftKey && tableRow) {
      const allRows = table.getSortedRowModel().rows
      const anchorId = lastSelectedIdRef.current
      const targetIdx = allRows.findIndex(r => r.id === tableRow.id)
      const anchorIdx = anchorId ? allRows.findIndex(r => r.id === anchorId) : targetIdx
      const [from, to] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
      const next = { ...rowSelection }
      for (let i = from; i <= to; i++) next[allRows[i].id] = true
      setRowSelection(next)
      lastSelectedIdRef.current = tableRow.id
      return
    }
    // Plain click while a multi-selection is active: treat as a selection
    // toggle, NOT a detail-open. Matches the way file managers and email
    // clients behave when you're in "selecting mode" — every click adds or
    // removes from the set; you exit selecting mode with Esc.
    const hasSelection = Object.keys(rowSelection).length > 0
    if (hasSelection && tableRow) {
      tableRow.toggleSelected()
      lastSelectedIdRef.current = tableRow.id
      return
    }
    if (tableRow) lastSelectedIdRef.current = tableRow.id
    if (detailRenderer) setDetailRow(row)
    else if (onRowClick) onRowClick(row)
  }
  // Double-click: bypass the multi-select-toggle path so the user can open
  // detail even while a multi-select is active. Falls through to the normal
  // open path if no caller handler is provided.
  const handleRowDoubleClick = (row: T) => {
    if (onRowDoubleClick) { onRowDoubleClick(row); return }
    if (detailRenderer) { setDetailRow(row); return }
    if (onRowClick) onRowClick(row)
  }
  // Middle-click (mouse wheel): caller decides what to do. No fallback —
  // we don't want to surprise tables that haven't opted in.
  const handleRowMiddleClick = (row: T) => {
    if (onRowMiddleClick) onRowMiddleClick(row)
  }

  // Keyboard shortcuts on the table root. Source-ordered roughly by usage
  // frequency — most-frequent at the top so the typing guard triggers fast.
  //
  //   Ctrl/Cmd + F  →  focus global filter
  //   /             →  focus global filter (vim-style)
  //   Esc           →  cascade: clear filter → clear selection (Radix dialogs
  //                    intercept Esc above DataTable, so an open detail modal
  //                    closes first via the dialog itself)
  //   Del / Bksp    →  clear selection
  //
  //   j / ↓         →  cursor down 1 row    · Shift+j → extend selection down
  //   k / ↑         →  cursor up 1 row      · Shift+k → extend selection up
  //   Home          →  cursor to first row
  //   End           →  cursor to last row
  //   PageDown      →  cursor down 10 rows
  //   PageUp        →  cursor up 10 rows
  //   Enter         →  open detail (onRowClick) for focused row
  //   x / Space     →  toggle focused row's checkbox
  //
  //   Ctrl/Cmd + A  →  select all visible (confirms if >100 rows)
  //   Ctrl/Cmd + C  →  copy rowKey() of selected rows (one per line, +toast)
  //
  // Anything else with a non-modifier letter key (`f`, `F`, `o`, `O`, etc.)
  // is dispatched to onKeyboardCommand so callers can wire domain-specific
  // shortcuts without forking DataTable.
  const handleRootKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement | null)?.tagName
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      // FindBar takes precedence when enabled — it owns its own input
      // focus + Esc handling internally. Falls back to focusing the
      // inline filter input for callers that opt out.
      if (findBarEnabled) {
        setFindBarOpen(true)
      } else {
        filterInputRef.current?.focus()
        filterInputRef.current?.select()
      }
      return
    }
    if (e.key === 'Escape') {
      if (typing && tag === 'INPUT' && (e.target as HTMLInputElement).value) {
        ;(e.target as HTMLInputElement).value = ''
        setGlobalFilter('')
        return
      }
      if (findBarOpen) { setFindBarOpen(false); setGlobalFilter(''); return }
      if (globalFilter) { setGlobalFilter(''); return }
      if (Object.keys(rowSelection).length) { table.resetRowSelection(); return }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
      if (Object.keys(rowSelection).length) {
        e.preventDefault()
        table.resetRowSelection()
      }
    }
    if (typing) return

    const visibleRows = table.getRowModel().rows
    const last = visibleRows.length - 1
    if (last < 0) return

    const moveTo = (next: number) => {
      const clamped = Math.max(0, Math.min(last, next))
      setFocusedRowIndex(clamped)
      // Defer the scroll so React commits the data-focused attribute first.
      requestAnimationFrame(() => {
        rootRef.current?.querySelector('[data-focused="true"]')
          ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
      })
      return clamped
    }

    // Ctrl/Cmd + A — select all visible. Confirm above 100 rows so a
    // muscle-memory keystroke doesn't prime mass-mutation buttons.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      const proceed = visibleRows.length <= 100
        || window.confirm(`Select all ${visibleRows.length} visible rows?`)
      if (proceed) table.toggleAllRowsSelected(true)
      return
    }
    // Ctrl/Cmd + C — copy rowKey of selected rows to clipboard.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const sel = visibleRows.filter(r => r.getIsSelected())
      if (sel.length === 0) return  // let the browser handle text-copy
      e.preventDefault()
      const text = sel.map(r => rowKey(r.original as T)).join('\n')
      void navigator.clipboard?.writeText(text).then(
        () => onNotify?.(`Copied ${sel.length} ID${sel.length === 1 ? '' : 's'}`, 'success'),
        () => onNotify?.('Clipboard unavailable', 'error'),
      )
      return
    }

    // Cursor movement.
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = moveTo((focusedRowIndex ?? -1) + 1)
      // Shift extends selection — anchor at lastSelectedIdRef, fill range.
      if (e.shiftKey) {
        const target = visibleRows[nextIdx]
        if (target) target.toggleSelected(true)
      }
      return
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIdx = moveTo((focusedRowIndex ?? last + 1) - 1)
      if (e.shiftKey) {
        const target = visibleRows[nextIdx]
        if (target) target.toggleSelected(true)
      }
      return
    }
    if (e.key === 'Home') { e.preventDefault(); moveTo(0); return }
    if (e.key === 'End')  { e.preventDefault(); moveTo(last); return }
    if (e.key === 'PageDown') {
      e.preventDefault()
      moveTo((focusedRowIndex ?? -1) + 10)
      return
    }
    if (e.key === 'PageUp') {
      e.preventDefault()
      moveTo((focusedRowIndex ?? last + 1) - 10)
      return
    }
    if (e.key === '/') {
      e.preventDefault()
      filterInputRef.current?.focus()
      filterInputRef.current?.select()
      return
    }

    // Focus-row dependent shortcuts.
    if (focusedRowIndex == null) return
    const row = visibleRows[focusedRowIndex]
    if (!row) return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRowClick(row.original as T)
      return
    }
    if (e.key === 'x' || e.key === ' ') {
      e.preventDefault()
      row.toggleSelected()
      return
    }

    // Domain-specific commands — dispatch to caller. The caller decides
    // whether to consume the key (e.preventDefault inside its handler).
    if (onKeyboardCommand && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      onKeyboardCommand(e.key, {
        focusedRow: row.original as T,
        focusedIndex: focusedRowIndex,
        visibleRows: visibleRows.map(r => r.original as T),
        setFocusedIndex: (i) => setFocusedRowIndex(i),
        e,
      })
    }
  }

  // ── Saved views actions ──
  const applyView = (view: SavedView) => {
    // Visibility must merge view.visibility ON TOP OF the meta.defaultHidden
    // seed, not replace it. Saved views post-normalization (see saveCurrentAs)
    // store ONLY real deviations from default, so an empty `view.visibility`
    // means "use defaults" — which means re-applying the defaultHidden=true
    // columns as false. Without the merge, applying a normalized view
    // resets every defaultHidden column to visible.
    const seed: VisibilityState = {}
    for (const c of columns) {
      const meta = (c as ColumnDef<T, unknown> & { meta?: { defaultHidden?: boolean } }).meta
      const id = (c as ColumnDef<T, unknown> & { id?: string }).id
      if (meta?.defaultHidden && id) seed[id] = false
    }
    const mergedVisibility: VisibilityState = { ...seed, ...(view.visibility ?? {}) }

    setSorting(view.sorting ?? [])
    setColumnSizing(view.sizing ?? {})
    setColumnVisibility(mergedVisibility)
    setColumnOrder(view.order ?? initialOrder)
    setColumnFilters(view.filters ?? [])
    setPrefs((p) => ({
      ...p,
      sorting: view.sorting ?? [],
      sizing: view.sizing ?? {},
      visibility: mergedVisibility,
      order: view.order ?? initialOrder,
      filters: view.filters ?? [],
      density: view.density ?? p.density,
      activeView: view.name,
    }))
  }
  const saveCurrentAs = (name: string) => {
    // Normalize the visibility map: drop entries that match each
    // column's `meta.defaultHidden` flag. The serialized view then only
    // carries REAL deviations from default. Without this, "Hide all"
    // followed by "Save view" persisted 44 false entries — restoring
    // the view re-hid every column even after the user reset state.
    const normalizedVis: VisibilityState = {}
    for (const [id, vis] of Object.entries(columnVisibility)) {
      const colDef = columns.find((c) => (c as ColumnDef<T, unknown> & { id?: string }).id === id)
      const meta = (colDef as ColumnDef<T, unknown> & { meta?: { defaultHidden?: boolean } } | undefined)?.meta
      const defaultVis = !meta?.defaultHidden  // no flag = visible by default; flag=true = hidden by default
      if (vis !== defaultVis) normalizedVis[id] = vis
    }
    const view: SavedView = {
      name,
      sorting, sizing: columnSizing, visibility: normalizedVis,
      order: columnOrder, filters: columnFilters, density,
    }
    setPrefs((p) => ({
      ...p,
      views: [...(p.views ?? []).filter((v) => v.name !== name), view],
      activeView: name,
    }))
  }
  /** Overwrite the currently-active view with the current state. Used by
   *  the "Update X" menu item — same as saveCurrentAs but doesn't prompt
   *  for a name, doesn't change activeView. */
  const updateActiveView = () => {
    const name = prefs.activeView
    if (!name) return
    saveCurrentAs(name)
  }
  /** Re-apply the active view's saved snapshot, discarding any local edits
   *  the user made since switching to it. */
  const resetActiveView = () => {
    const name = prefs.activeView
    if (!name) return
    const saved = (prefs.views ?? []).find((v) => v.name === name)
    if (saved) applyView(saved)
  }
  const deleteView = (name: string) => {
    setPrefs((p) => ({
      ...p,
      views: (p.views ?? []).filter((v) => v.name !== name),
      activeView: p.activeView === name ? null : p.activeView,
    }))
  }
  /** Dirty = the live state diverges from the active view's snapshot.
   *  Memoized + short-circuited when no view is active (the common case) —
   *  the JSON.stringify chain was running on every render even when there
   *  was nothing to compare against, which is ~7 stringify passes per
   *  render for a moderately-sized prefs blob. */
  const activeViewDirty = useMemo(() => {
    const name = prefs.activeView
    if (!name) return false
    const saved = (prefs.views ?? []).find((v) => v.name === name)
    if (!saved) return false
    const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    if (!eq(saved.sorting,    sorting))         return true
    if (!eq(saved.sizing,     columnSizing))    return true
    if (!eq(saved.visibility, columnVisibility)) return true
    if (!eq(saved.order,      columnOrder))     return true
    if (!eq(saved.filters,    columnFilters))   return true
    if ((saved.density ?? 'default') !== density) return true
    return false
  }, [prefs.activeView, prefs.views, sorting, columnSizing, columnVisibility, columnOrder, columnFilters, density])

  return (
    <>
      <div
        ref={rootRef}
        tabIndex={-1}
        onKeyDown={handleRootKeyDown}
        // data-filtering=true when the user is searching — the row CSS uses
        // it to add an outline to the focused row so the active match pops.
        data-filtering={globalFilter ? 'true' : undefined}
        className={cn(
          'relative flex flex-col rounded-[var(--radius-lg)] bg-[var(--surface)] surface-raised overflow-hidden outline-none',
          fillHeight && 'h-full min-h-0',
          // Active find-match outline: only when we're filtering AND a row is
          // focused, scope to the descendant focused row.
          '[&[data-filtering=true]_[data-focused=true]]:outline [&[data-filtering=true]_[data-focused=true]]:outline-1 [&[data-filtering=true]_[data-focused=true]]:outline-[var(--accent)]',
          className
        )}
      >
        {/* Toolbar */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]',
          // liftedHeader gives the chrome a true middle tone — 50/50 mix
          // between --bg (body) and --surface-2 (the SAS card's top strip).
          // Result: top strip lightest, this band middle, body darkest, so
          // the three layers read as a clean tonal staircase.
          liftedHeader && 'bg-[color-mix(in_srgb,var(--surface-2)_50%,var(--bg)_50%)]'
        )}>
          {showGlobalFilter && (
            <div className="relative flex-1 max-w-[320px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <IcoFilter size={13} />
              </span>
              <input
                ref={filterInputRef}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={globalFilterPlaceholder}
                className="w-full h-7 pl-7 pr-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-bd)]"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {/* S1 — passive selection-count chip. Visible only when 1+ rows
                are selected. Clicking "Clear" wipes the selection (same as
                Esc). Sits at the start of the right cluster so it reads
                before view/density/columns chrome. */}
            {Object.keys(rowSelection).length > 0 && (
              <button
                type="button"
                onClick={() => table.resetRowSelection()}
                title="Clear selection (Esc)"
                className={cn(
                  // 40x40 hit-area extension via ::before — visible chip is
                  // h-7 (28px) which is below the 40x40 tap-target floor.
                  // The pseudo sits behind so the visible chrome (border,
                  // bg) stays unchanged.
                  'relative inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md',
                  'bg-[var(--accent-dim)] border border-[var(--accent-bd)]',
                  'text-[11px] mono tabular-nums text-[var(--accent)] hover:brightness-110',
                  // Specific transition list — never `transition: all`.
                  // active:scale-[0.96] gives a tactile press without
                  // dropping below 0.95.
                  'transition-[filter,transform] duration-150 active:scale-[0.96]',
                  'before:absolute before:inset-x-0 before:top-1/2 before:-translate-y-1/2',
                  'before:h-10 before:content-[""] before:-z-10',
                )}
              >
                <span className="font-semibold">{Object.keys(rowSelection).length}</span>
                <span className="text-[var(--text-dim)]">selected</span>
                <span aria-hidden className="text-[var(--text-muted)]">·</span>
                <span className="uppercase tracking-[0.06em] text-[10px]">Clear</span>
              </button>
            )}
            {toolbar}
            {showViewsMenu && tableId && (
              <SavedViewsMenu
                views={prefs.views ?? []}
                activeView={prefs.activeView ?? null}
                activeViewDirty={activeViewDirty}
                onApply={applyView}
                onSave={saveCurrentAs}
                onUpdate={updateActiveView}
                onReset={resetActiveView}
                onDelete={deleteView}
              />
            )}
            {showDensityToggle && (
              <SegmentedControl<TableDensity>
                value={density}
                onChange={(d) => setPrefs((p) => ({ ...p, density: d }))}
                options={[
                  { value: 'compact', label: 'Tight' },
                  { value: 'default', label: 'Auto' },
                  { value: 'relaxed', label: 'Roomy' },
                ]}
                size="sm"
              />
            )}
            {showColumnMenu && (
              <ColumnVisibilityMenu
                table={table}
                onBulkChangeStart={() => { suppressVisBroadcastRef.current = true }}
                onResetAll={() => {
                  // Atomic Reset: clear every sink so the user has a true
                  // "back to default" path. Without this, Reset only fixes
                  // local in-memory state — the cross-table cache and
                  // top-level prefs.visibility persistently re-poison
                  // on the next render or sibling-table mount.
                  //
                  // Note: table.resetColumnVisibility() sets to {} (empty)
                  // when the table is in controlled mode without an
                  // explicit initialState — that loses the
                  // `meta.defaultHidden:true` columns' falses so they
                  // become visible. Instead, compute the seed directly
                  // (matches the lazy useState init at line ~543) and
                  // apply it as a single setColumnVisibility call so the
                  // suppression flag covers the entire bulk change.
                  const seed: VisibilityState = {}
                  for (const c of columns) {
                    const meta = (c as ColumnDef<T, unknown> & { meta?: { defaultHidden?: boolean } }).meta
                    const id = (c as ColumnDef<T, unknown> & { id?: string }).id
                    if (meta?.defaultHidden && id) seed[id] = false
                  }
                  suppressVisBroadcastRef.current = true
                  table.setColumnVisibility(seed)
                  // The onColumnVisibilityChange handler will write `seed`
                  // into prefs.visibility. We don't need to set it again
                  // here — that would double-write and could race with
                  // the change handler.
                  if (syncColumnsByLabel) {
                    const labels = table
                      .getAllLeafColumns()
                      .map((c) => {
                        const h = c.columnDef.header
                        return typeof h === 'string' ? h : c.id
                      })
                    clearGlobalVisForLabels(labels)
                  }
                }}
              />
            )}
            {showViewOptions && (
              <ViewOptionsMenu
                value={{
                  compact: effectiveCompact,
                  zebra: effectiveZebra,
                  gridLines: effectiveGridLines,
                  pinFirstColumns: effectivePinCount,
                }}
                // When the user toggles "Pin first columns" on, use the
                // consumer's specified `stickyLeftCount` prop (default 0 → 1).
                // This way callers who set `stickyLeftCount={3}` get 3 columns
                // pinned when toggled on, and the menu just owns the on/off.
                pinCountWhenEnabled={Math.max(stickyLeftCount, 1)}
                onChange={(next) => {
                  setPrefs((p) => ({ ...p, viewOptions: { ...(p.viewOptions ?? {}), ...next } }))
                  onViewOptionsChange?.(next)
                }}
                onCopyViewUrl={async () => {
                  // Encode current prefs → base64 URL param. Round-trips via
                  // applyViewFromUrl() on the receiver's mount.
                  try {
                    const encoded = encodeTablePrefs(prefs)
                    const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`
                    await navigator.clipboard?.writeText(url)
                    onNotify?.('View URL copied — paste anywhere to share this view', 'success')
                  } catch {
                    onNotify?.('Clipboard write failed', 'error')
                  }
                }}
              />
            )}
            {moreActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="xs" variant="outline" className={cn('gap-1.5', moreActionsClassName)} title="More actions">
                    <IcoMoreH size={11} /> More
                    <IcoChevronDown size={10} className="text-[var(--text-muted)]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px] surface-float">
                  {moreActions}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Bulk actions bar — overlays the DataTable toolbar above when a
            selection is active, so the table doesn't reflow. Slides down
            with a 4px translateY + fade. Sits at z-30 to clear the
            sticky table header (z-20).
            Background MUST be opaque (the underlying toolbar's filter
            input + density toggles would bleed through `var(--accent-dim)`,
            which is a transparent color-mix). Solid surface-2 base with
            an accent tint via box-shadow inset gives the same look. */}
        {bulkActions && (
          <div
            aria-hidden={selectedCount === 0 ? 'true' : undefined}
            className={cn(
              'absolute left-0 right-0 z-30 flex items-center gap-3 px-3 py-2',
              'bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface-2))]',
              'border-b border-[var(--accent-bd)] shadow-[0_2px_12px_-2px_rgba(0,0,0,0.4)]',
              // Specific properties + 200ms with the make-interfaces-feel-better
              // easing — replaces the previous 150ms ease-out so the bar's
              // slide-down feels intentional rather than abrupt.
              'transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
              selectedCount > 0
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 -translate-y-1 pointer-events-none',
            )}
            style={{ top: 0 }}
          >
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--accent)]">
              <span className="mono tabular-nums">{selectedCount}</span>
              selected
            </span>
            <button
              onClick={clearSelection}
              // Visible button is implicitly small (just text + icon); the
              // ::before pseudo extends the click target to 40x40 so it
              // stays in line with the rest of the bulk-action affordances.
              // Specific transition list (color + transform) for the
              // active:scale-[0.96] press.
              className="relative inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text)] transition-[color,transform] duration-150 active:scale-[0.96] before:absolute before:inset-x-0 before:top-1/2 before:-translate-y-1/2 before:h-10 before:content-[''] before:-z-10"
              aria-label="Clear selection"
            >
              <IcoClose size={10} /> Clear
            </button>
            <div className="flex-1" />
            {/* Wrapping bulk-actions: at narrow viewports a 9-button toolbar
                (e.g. ManualScan) used to escape the parent's clipped overflow.
                `flex-wrap` + `min-w-0` lets the buttons reflow onto a second
                row when the available width is too small; `justify-end` keeps
                them right-aligned in both single- and multi-row states. The
                bar is `position:absolute` so growing taller is fine — it just
                overlays a bit more of the underlying toolbar. */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 justify-end">
              {bulkActions({ selected: selectedRows, count: selectedCount, clear: clearSelection })}
            </div>
          </div>
        )}

        {/* Table */}
        <div
          ref={containerRef}
          style={fillHeight ? undefined : { maxHeight }}
          className={cn('relative overflow-auto', fillHeight && 'flex-1 min-h-0')}
          // C7 — click on the empty area below/around the rows clears the
          // active selection. We detect "empty area" by checking that the
          // click target isn't inside a <tr> and isn't the table header.
          // Only fires when there IS a selection so a stray click on an
          // empty table doesn't trigger a no-op.
          onClick={(e) => {
            if (Object.keys(rowSelection).length === 0) return
            const t = e.target as HTMLElement | null
            if (t?.closest('tr')) return
            if (t?.closest('thead')) return
            table.resetRowSelection()
          }}
        >
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[]}
          >
            {/* width:100% + minWidth:totalSize lets the browser distribute extra
                horizontal space across cells (table-layout:auto treats explicit
                width as preferred-width, not max). When sum-of-cells > viewport
                we still get horizontal scroll via minWidth. Fixes the ~600px
                dead gutter on FA at 2560×1440 where 13 narrow columns summed
                well below content width.

                tableLayout:'fixed' kills auto distribution's content-driven
                fudge factor (a 20px BUY column was growing to 120px because
                "Buy" text needed room, while flex body cells stayed literal).
                With 'fixed', extra width distributes purely proportional to
                explicit cell widths — matching the flex body's distribution
                below, so header columns and body columns align exactly. */}
            <table className="border-collapse" style={{ width: '100%', minWidth: table.getTotalSize(), tableLayout: 'fixed' }}>
              <thead className={cn(
                'sticky top-0 z-20 shadow-[inset_0_-1px_0_var(--border)]',
                // liftedHeader gives the column-header band the same middle
                // tone as the toolbar above (50/50 between --bg and
                // --surface-2). Three-layer stack: top strip lightest,
                // toolbar+thead middle, body rows darkest.
                liftedHeader
                  ? 'bg-[color-mix(in_srgb,var(--surface-2)_50%,var(--bg)_50%)]'
                  : 'bg-[var(--surface)]'
              )}>
                {table.getHeaderGroups().map((hg) => {
                  const headerIds = hg.headers.map((h) => h.id)
                  const lastIdx = hg.headers.length - 1
                  // Pre-compute cumulative left offsets for sticky cells so each
                  // header knows where its left edge lands relative to the scroll
                  // container. Only the first stickyLeftCount cells get pinned.
                  const stickyOffsets: number[] = []
                  let acc = 0
                  for (let i = 0; i < hg.headers.length; i++) {
                    stickyOffsets[i] = acc
                    if (i < stickyLeftCount) acc += hg.headers[i].getSize()
                  }
                  return (
                    <tr key={hg.id}>
                      <SortableContext items={headerIds} strategy={horizontalListSortingStrategy}>
                        {hg.headers.map((h, i) => (
                          <HeaderCell
                            key={h.id}
                            headerId={h.id}
                            header={h}
                            density={tallHeader ? 'py-3 text-[10px]' : densityClass.header}
                            enableReorder={enableColumnReorder}
                            enableFilter={enableColumnFilters}
                            verticalRule={verticalRules && i < lastIdx}
                            stickyLeft={i < stickyLeftCount ? stickyOffsets[i] : undefined}
                            isLastSticky={stickyLeftCount > 0 && i === stickyLeftCount - 1}
                          />
                        ))}
                      </SortableContext>
                    </tr>
                  )
                })}
              </thead>
              <tbody style={shouldVirtualize ? { position: 'relative', height: totalHeight + topPinnedRows.length * rowHeight } : undefined}>
                {loading && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skel-${i}`} className="border-b border-[var(--border)]">
                        {headerCells.map((_c, ci) => (
                          <td key={ci} className="px-3 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
                {!loading && centerRows.length === 0 && topPinnedRows.length === 0 && (
                  <tr>
                    <td colSpan={headerCells.length} className="p-0">
                      <div className="p-6">
                        {emptyState ?? (
                          <EmptyState
                            title="No rows to show"
                            body="Adjust filters or import data to see results here."
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Pinned rows — render at top, always visible */}
                {!loading && topPinnedRows.map((row) => (
                  <BodyRow
                    key={`pin-${row.id}`}
                    row={row}
                    densityClass={densityClass.row}
                    onRowClick={handleRowClick}
                    onRowDoubleClick={handleRowDoubleClick}
                    onRowMiddleClick={handleRowMiddleClick}
                    isPinned
                    totalWidth={table.getTotalSize()}
                    extraClassName={rowClassName?.(row.original as T)}
                    verticalRules={effectiveGridLines}
                    zebra={effectiveZebra}
                    stickyLeftCount={effectivePinCount}
                    contextMenuContent={buildRowContextMenu(row)}
                  />
                ))}
                {/* Virtualized center rows */}
                {!loading && shouldVirtualize &&
                  virtualItems.map((vi) => {
                    const row = centerRows[vi.index]
                    return (
                      <BodyRow
                        key={row.id}
                        row={row}
                        densityClass={densityClass.row}
                        onRowClick={handleRowClick}
                    onRowDoubleClick={handleRowDoubleClick}
                    onRowMiddleClick={handleRowMiddleClick}
                        totalWidth={table.getTotalSize()}
                        extraClassName={rowClassName?.(row.original as T)}
                        verticalRules={effectiveGridLines}
                        zebra={effectiveZebra}
                      stickyLeftCount={effectivePinCount}
                      isFocused={focusedRowId != null && focusedRowId === row.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          transform: `translateY(${vi.start + topPinnedRows.length * rowHeight}px)`,
                          height: vi.size,
                        }}
                        contextMenuContent={buildRowContextMenu(row)}
                      />
                    )
                  })}
                {!loading && !shouldVirtualize &&
                  centerRows.map((row) => (
                    <BodyRow
                      key={row.id}
                      row={row}
                      densityClass={densityClass.row}
                      onRowClick={handleRowClick}
                    onRowDoubleClick={handleRowDoubleClick}
                    onRowMiddleClick={handleRowMiddleClick}
                      totalWidth={table.getTotalSize()}
                      extraClassName={rowClassName?.(row.original as T)}
                      verticalRules={effectiveGridLines}
                      zebra={effectiveZebra}
                      stickyLeftCount={effectivePinCount}
                      isFocused={focusedRowId != null && focusedRowId === row.id}
                      contextMenuContent={buildRowContextMenu(row)}
                    />
                  ))}
              </tbody>
            </table>

            {/* Drag ghost — shown while a column header is being dragged. Gives
               the user clear visual feedback that a column is moving. */}
            <DragOverlay>
              {activeDragHeader ? (
                <div
                  className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] font-semibold uppercase tracking-[0.06em] text-[11px] shadow-lg"
                  style={{ width: activeDragHeader.getSize() }}
                >
                  {typeof activeDragHeader.column.columnDef.header === 'string'
                    ? activeDragHeader.column.columnDef.header
                    : activeDragHeader.id}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Cmd+F find-bar overlay. Anchored to the bottom-right of the
            DataTable root via FindBar's own absolute positioning. The
            query feeds the same globalFilter state as the inline filter
            input — both UIs are equivalent. j/k still navigates rows;
            FindBar's ↑↓ buttons (and Enter / Shift+Enter) move the same
            focused-row cursor. */}
        {findBarEnabled && (
          <FindBar
            open={findBarOpen}
            onOpenChange={setFindBarOpen}
            query={globalFilter}
            onQueryChange={setGlobalFilter}
            matchCount={rows.length}
            matchIndex={
              focusedRowIndex != null && focusedRowIndex < rows.length
                ? focusedRowIndex + 1
                : 0
            }
            onNext={() => {
              const last = rows.length - 1
              if (last < 0) return
              // Wrap-around: past the last row, jump back to first. Standard
              // find-bar UX (browser Cmd+F behaves the same).
              const cur = focusedRowIndex ?? -1
              moveFocusTo(cur >= last ? 0 : cur + 1)
            }}
            onPrev={() => {
              const last = rows.length - 1
              if (last < 0) return
              // Wrap-around: before first, jump to last.
              const cur = focusedRowIndex ?? rows.length
              moveFocusTo(cur <= 0 ? last : cur - 1)
            }}
          />
        )}
      </div>

      {/* Row detail drawer */}
      {detailRenderer && (
        <Sheet open={detailRow !== null} onOpenChange={(o) => !o && setDetailRow(null)}>
          <SheetContent
            side="right"
            className="w-[520px] sm:max-w-[560px] bg-[var(--surface)] surface-float border-[var(--border)]"
          >
            {detailRow && (() => {
              const detail = detailRenderer(detailRow)
              return (
                <>
                  {(detail.title || detail.description) && (
                    <SheetHeader className="border-b border-[var(--border)] pb-3">
                      {detail.title && (
                        <SheetTitle className="font-[var(--font-display)] text-[18px]">
                          {detail.title}
                        </SheetTitle>
                      )}
                      {detail.description && (
                        <SheetDescription className="text-[12px] text-[var(--text-dim)]">
                          {detail.description}
                        </SheetDescription>
                      )}
                    </SheetHeader>
                  )}
                  <div className="flex-1 overflow-auto p-4">{detail.content}</div>
                </>
              )
            })()}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Header cell — handles sort, resize, reorder drag, filter popover
   ═══════════════════════════════════════════════════════════════════ */

function HeaderCell<T>({
  headerId,
  header,
  density,
  enableReorder,
  enableFilter,
  verticalRule,
  stickyLeft,
  isLastSticky,
}: {
  headerId: string
  header: Header<T, unknown>
  density: string
  enableReorder: boolean
  enableFilter: boolean
  verticalRule?: boolean
  stickyLeft?: number
  isLastSticky?: boolean
}) {
  const canSort = header.column.getCanSort()
  const canResize = header.column.getCanResize()
  const sortDir = header.column.getIsSorted()
  // Multi-sort priority — getSortIndex() returns 0-based position in the
  // sort chain. Show a small numeric badge next to the arrow when there
  // are 2+ active sorts so the user can tell `Profit ↓1, ROI ↓2` from
  // a single-column sort.
  const sortIndex = header.column.getSortIndex()
  const totalSorts = header.column.getCanSort()
    ? header.getContext().table.getState().sorting.length
    : 0
  const showSortBadge = sortDir && totalSorts > 1 && sortIndex >= 0
  const canDrag = enableReorder && !header.column.columnDef.id?.startsWith('__')
  const canFilter = enableFilter && header.column.getCanFilter() && !header.column.columnDef.id?.startsWith('__')
  const meta = header.column.columnDef.meta as { tone?: ColumnTone; description?: string } | undefined
  const isNumeric = meta?.tone === 'numeric'

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: headerId,
    disabled: !canDrag,
  })

  // Intentionally DO NOT apply CSS.Translate.toString(transform) to the <th>.
  // The sticky thead (`position: sticky`) fights with CSS transforms — it made
  // the dragged header appear to not move at all. Visual feedback is provided
  // by the <DragOverlay> ghost above the table instead.
  const isSticky = typeof stickyLeft === 'number'
  const style: React.CSSProperties = {
    width: header.getSize(),
    position: isSticky ? 'sticky' : 'relative',
    left: isSticky ? stickyLeft : undefined,
    // Sticky headers need to layer above sticky rows (z-10) AND above the
    // sticky thead's own backdrop (z-20) — bump to 30 so they win both axes.
    zIndex: isDragging ? 50 : (isSticky ? 30 : undefined),
    // Stronger visual feedback while dragging — the column now floats with
    // a 2px accent ring + subtle shadow so the drop target column on either
    // side shows through clearly. Matches Keepa's "this column is moving"
    // affordance instead of the previous near-invisible 0.4 opacity.
    opacity: isDragging ? 0.85 : 1,
    boxShadow: isDragging
      ? '0 0 0 2px var(--accent), 0 8px 20px -4px color-mix(in srgb, var(--accent) 50%, transparent)'
      : undefined,
    // Inherit the thead's bg so sticky-left header cells stay in sync if the
    // thead bg ever varies (it currently doesn't, but `inherit` is correct).
    background: isDragging
      ? 'var(--surface-2)'
      : isSticky ? 'inherit' : undefined,
    // Last-sticky boundary: 1px hairline so the user can see where pinned
    // columns end. Avoids the box-shadow approach (which painted darkness
    // into adjacent cells and made the zebra read as two-toned).
    borderRight: isLastSticky ? '1px solid var(--border-strong)' : undefined,
  }

  // Drag listeners live on the <th> itself so dragging ANYWHERE on the header
  // moves the column — not just the tiny six-dots icon. PointerSensor's
  // activationConstraint (distance: 4) keeps plain clicks from starting a drag.
  // aria-sort is omitted on non-sortable columns — emitting "none" everywhere
  // is noisy for screen readers since SR users hear it on every header.
  // Spread via an object so jsx-a11y/aria-proptypes doesn't flag the
  // conditional expression as an "invalid value".
  const ariaSortProps: { 'aria-sort'?: 'ascending' | 'descending' | 'none' } = canSort
    ? {
        'aria-sort':
          sortDir === 'asc' ? 'ascending'
          : sortDir === 'desc' ? 'descending'
          : 'none',
      }
    : {}
  return (
    <th
      ref={setNodeRef}
      style={style}
      title={meta?.description}
      {...ariaSortProps}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        // Header text — color-mix lifts the dim color about halfway toward
        // full text so column titles read as click targets without inverting
        // the body→header hierarchy. (`var(--text-dim)` alone was too soft
        // against the surface-2 thead bg.)
        'group/header px-3 font-semibold uppercase tracking-[0.06em] text-[color-mix(in_srgb,var(--text)_55%,var(--text-dim))]',
        isNumeric ? 'text-right' : 'text-left',
        density,
        canSort && 'select-none hover:text-[var(--text)]',
        canDrag && 'cursor-grab active:cursor-grabbing touch-none',
        verticalRule && 'border-r border-[var(--border)]',
        // Active-sort accent tint — header label switches to --accent and the
        // cell gets a faint accent wash so the user can find the active sort
        // even after horizontal-scrolling across 12+ columns.
        sortDir && '!text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
      )}
    >
      <div className={cn('flex items-center gap-1.5', isNumeric && 'justify-end')}>
        {canDrag && (
          // Faint at rest so the column doesn't look cluttered, but always
          // visible so the user knows the header is draggable.
          <IcoGripVertical
            size={12}
            className="opacity-30 group-hover/header:opacity-90 text-[var(--text-muted)] transition-opacity"
            aria-hidden
          />
        )}
        <span
          className={cn('flex-1 inline-flex items-center gap-1', canSort && 'cursor-pointer')}
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
          // Block dnd-kit pointerdown on the sort target so a slight pointer
          // jitter during a click doesn't activate column drag.
          onPointerDown={canSort ? (e) => e.stopPropagation() : undefined}
        >
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
          {sortDir === 'asc' && <span aria-hidden className="text-[var(--accent)]">▲</span>}
          {sortDir === 'desc' && <span aria-hidden className="text-[var(--accent)]">▼</span>}
          {showSortBadge && (
            <span
              aria-hidden
              className="inline-flex items-center justify-center min-w-[12px] h-[12px] px-[3px] rounded-[3px] text-[8px] font-mono font-bold tabular-nums bg-[var(--accent)] text-[var(--accent-fg)]"
              title={`Sort priority ${sortIndex + 1}`}
            >
              {sortIndex + 1}
            </span>
          )}
        </span>
        {canFilter && <ColumnFilterTrigger column={header.column} />}
      </div>
      {canResize && (
        <button
          type="button"
          aria-label="Resize column"
          // stopPropagation on pointerdown prevents dnd-kit's sensor from
          // treating the resize gesture as the start of a column-drag.
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // cursor-col-resize is intrinsic to the handle's hit area —
            // pointer only sees it when actually over the 6px strip.
            // bg-color hover pre-states the resize affordance.
            'absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none',
            'transition-[background-color,box-shadow] duration-150',
            'hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]',
            // Active-resize: subtle accent shadow (not a hard solid bar)
            // so the live drag reads as a glow following the pointer
            // instead of a column-wide guideline that competes with the
            // header text. shadow rule is layered transparent → blends
            // into any thead bg.
            header.column.getIsResizing() &&
              'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_50%,transparent),0_0_8px_color-mix(in_srgb,var(--accent)_55%,transparent)]'
          )}
        />
      )}
    </th>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Body row
   ═══════════════════════════════════════════════════════════════════ */

function BodyRow<T>({
  row,
  densityClass,
  onRowClick,
  onRowDoubleClick,
  onRowMiddleClick,
  isPinned,
  totalWidth,
  style,
  extraClassName,
  verticalRules,
  zebra = true,
  stickyLeftCount = 0,
  isFocused,
  contextMenuContent,
}: {
  row: Row<T>
  densityClass: string
  onRowClick: (row: T, e?: React.MouseEvent) => void
  onRowDoubleClick?: (row: T) => void
  onRowMiddleClick?: (row: T) => void
  isPinned?: boolean
  totalWidth: number
  style?: React.CSSProperties
  extraClassName?: string | null
  verticalRules?: boolean
  zebra?: boolean
  stickyLeftCount?: number
  isFocused?: boolean
  /** Optional ContextMenuContent JSX to render alongside this row's
   *  ContextMenuTrigger. When provided, the `<tr>` is wrapped in a Radix
   *  `<ContextMenu>` so right-click opens the menu instead of the browser's
   *  native context menu. */
  contextMenuContent?: ReactNode
}) {
  const virtualized = style !== undefined
  const cells = row.getVisibleCells()
  const lastCellIdx = cells.length - 1
  // Pre-compute cumulative left offsets for sticky cells (matches the header
  // computation so columns line up vertically).
  const stickyOffsets: number[] = []
  let acc = 0
  for (let i = 0; i < cells.length; i++) {
    stickyOffsets[i] = acc
    if (i < stickyLeftCount) acc += cells[i].column.getSize()
  }
  const trElement = (
    <tr
      onClick={(e) => onRowClick(row.original as T, e)}
      onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row.original as T) : undefined}
      // onAuxClick fires for non-primary mouse buttons. Middle-click = button 1.
      onAuxClick={onRowMiddleClick ? (e) => {
        if (e.button === 1) {
          e.preventDefault()
          onRowMiddleClick(row.original as T)
        }
      } : undefined}
      data-row-key={row.id}
      data-selected={row.getIsSelected() || undefined}
      data-pinned={isPinned || undefined}
      data-focused={isFocused ? 'true' : undefined}
      // Mirror the table-level layout fix: when columns sum less than the
      // container, browser distributes extra width across cells (1440p+);
      // when they overflow, minWidth forces horizontal scroll. Using a
      // fixed `width: totalWidth` here would leave virtualized rows hugging
      // the left while the (non-virtualized) thead spans full width — visible
      // misalignment at >200 rows on wide viewports.
      //
      // overflow: hidden is a defense-in-depth — DENSITY_ROW_H is sized to
      // accommodate normal cell content, but if a future cell becomes
      // taller (longer ProductCell variant, multi-line meta chips), this
      // clips the bleed instead of letting it paint into the next row's
      // translateY slot (the KPF stacking bug fixed 2026-05-07).
      style={virtualized ? { ...style, width: '100%', minWidth: totalWidth, overflow: 'hidden' } : undefined}
      className={cn(
        // group/row is REQUIRED on every row variant — the pin column's
        // hover-to-reveal ("opacity-0 group-hover/row:opacity-100") needs
        // the named group anchor to fire. Earlier the virtualized branch
        // used only `flex w-full` and the pin icon stayed invisible on
        // virtualized tables (FA's 2786 rows), making it impossible to
        // pin OR unpin without already-pinned rows.
        'group/row',
        virtualized && 'flex w-full',
        'border-b border-[var(--border)]',
        // Zebra striping on odd rows (1st, 3rd, 5th, …) so the pattern
        // starts at the top of the table. Comes BEFORE hover/focused/
        // selected so those state classes win when both apply. White 1.5%
        // is the gentlest tint that still reads on the dark table body
        // without competing with semantic state colors. Toggle via `zebra`.
        zebra && 'odd:bg-[color-mix(in_srgb,white_1.5%,transparent)]',
        'hover:bg-[var(--surface-2)]',
        // Keyboard cursor — left-edge accent stripe so the user always knows
        // what j/k focused and what Enter / x will act on.
        'data-[focused=true]:shadow-[inset_3px_0_0_0_var(--accent)] data-[focused=true]:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]',
        'data-[selected]:bg-[var(--accent-dim)]',
        'data-[pinned]:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]',
        'data-[pinned]:sticky data-[pinned]:z-10',
        'cursor-pointer',
        extraClassName
      )}
    >
      {cells.map((c, i) => {
        const meta = c.column.columnDef.meta as { tone?: ColumnTone } | undefined
        const isNumeric = meta?.tone === 'numeric'
        const isCenter = meta?.tone === 'center'
        const isSticky = i < stickyLeftCount
        const isLastSticky = stickyLeftCount > 0 && i === stickyLeftCount - 1
        return (
          <td
            key={c.id}
            style={{
              width: c.column.getSize(),
              // flex grow proportional to size, no shrink. Only takes effect
              // when the parent <tr> is display:flex (virtualized mode); for
              // non-virtualized table-row mode the browser ignores flex
              // properties on table cells. Combined with tableLayout:'fixed'
              // on the <table>, this makes body cells distribute extra
              // horizontal space identically to header cells — closes the
              // "last column gutter" misalignment where the header was
              // 215px and the body cell stayed at the literal 144px.
              flex: `${c.column.getSize()} 0 ${c.column.getSize()}px`,
              position: isSticky ? 'sticky' : undefined,
              left: isSticky ? stickyOffsets[i] : undefined,
              zIndex: isSticky ? 10 : undefined,
              // EVERY cell uses background: inherit so the row's bg (zebra,
              // hover, focused, selected) paints uniformly across the entire
              // row. Without this the non-sticky cells were showing the
              // table backdrop through (transparent default), making the
              // zebra-tinted sticky cells look like a different color from
              // the un-tinted non-sticky cells in the same row.
              background: 'inherit',
              // Last-sticky boundary: 1px hairline (matches header). The
              // earlier box-shadow leaked darkness onto adjacent cells and
              // made the zebra striping look two-toned across the boundary.
              borderRight: isLastSticky ? '1px solid var(--border-strong)' : undefined,
            }}
            className={cn(
              'px-3 text-[var(--text)]',
              densityClass,
              isNumeric && 'text-right tabular-nums',
              isCenter && 'text-center',
              verticalRules && i < lastCellIdx && 'border-r border-[var(--border)]'
            )}
          >
            {flexRender(c.column.columnDef.cell, c.getContext())}
          </td>
        )
      })}
    </tr>
  )
  // Bare row when no context-menu content is provided — keeps zero overhead for
  // tables that don't opt into right-click. When provided, wrap in a Radix
  // ContextMenu so the browser's native menu is suppressed and our content
  // shows instead. Content is portal'd via <ContextMenuContent> so it doesn't
  // affect the <tr>'s layout or the table's flex/sticky rendering.
  if (!contextMenuContent) return trElement
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{trElement}</ContextMenuTrigger>
      {contextMenuContent}
    </ContextMenu>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Column visibility menu
   ═══════════════════════════════════════════════════════════════════ */

function ColumnVisibilityMenu<T>({
  table, onBulkChangeStart, onResetAll,
}: {
  table: TanTable<T>
  /** Called BEFORE Show all / Hide all mutates state. Lets the caller
   *  set a suppression flag so the cross-table broadcast skips this
   *  bulk change. */
  onBulkChangeStart?: () => void
  /** Called when the user clicks Reset. Caller is expected to clear
   *  every persistence sink (in-memory state, prefs.visibility,
   *  globalColVis cache) atomically — see usage in DataTable. */
  onResetAll?: () => void
}) {
  const hideable = table.getAllLeafColumns().filter((col) => col.getCanHide())
  if (hideable.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="gap-1.5">
          <IcoColumns size={11} />
          Columns
          <IcoChevronDown size={10} className="text-[var(--text-muted)]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] surface-float">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Visible columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Bulk visibility controls — Show all / Hide all / Reset.
            Each calls onBulkChangeStart so the table can suppress the
            cross-table broadcast for the bulk change cycle. Reset
            additionally calls onResetAll, which clears prefs.visibility
            and the cross-table cache for this table's columns — a true
            "back to default" escape valve. */}
        <div className="flex items-center gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => {
              onBulkChangeStart?.()
              // ONE setColumnVisibility call — issues a SINGLE
              // onColumnVisibilityChange so the suppression flag isn't
              // consumed after the first column. Per-column
              // toggleVisibility() in a forEach was the bug: it fires
              // N independent change handlers, the flag is consumed on
              // the first, and the remaining N-1 broadcast as if they
              // were normal user toggles.
              table.setColumnVisibility((prev) => {
                const next = { ...prev }
                for (const c of hideable) next[c.id] = true
                return next
              })
            }}
            className="flex-1 text-[10px] uppercase tracking-[0.08em] font-semibold py-1 px-2 rounded text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={() => {
              onBulkChangeStart?.()
              table.setColumnVisibility((prev) => {
                const next = { ...prev }
                for (const c of hideable) next[c.id] = false
                return next
              })
            }}
            className="flex-1 text-[10px] uppercase tracking-[0.08em] font-semibold py-1 px-2 rounded text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
          >
            Hide all
          </button>
          <button
            type="button"
            onClick={() => onResetAll ? onResetAll() : table.resetColumnVisibility()}
            className="flex-1 text-[10px] uppercase tracking-[0.08em] font-semibold py-1 px-2 rounded text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
            title="Reset every column to its default visibility (also clears cross-table cache for this table)"
          >
            Reset
          </button>
        </div>
        <DropdownMenuSeparator />
        {hideable.map((col) => {
          const headerDef = col.columnDef.header
          const label = typeof headerDef === 'string' ? headerDef : col.id
          return (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.getIsVisible()}
              onCheckedChange={(v) => col.toggleVisibility(!!v)}
              onSelect={(e) => e.preventDefault()}
              className="text-[12px] capitalize"
            >
              {label}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   View options menu — Compact / Zebra / Grid lines / Pin first columns
   + Copy view URL. Lives in the toolbar next to the Columns dropdown.
   State is owned by the parent DataTable via prefs.viewOptions; this
   component is pure presentational + change-emitter.
   ═══════════════════════════════════════════════════════════════════ */

function ViewOptionsMenu({
  value,
  pinCountWhenEnabled,
  onChange,
  onCopyViewUrl,
}: {
  value: ViewOptions
  /** Number of columns to pin when the "Pin first columns" toggle is enabled
   *  (the OFF state is always 0). Comes from the consumer's `stickyLeftCount`
   *  prop — lets a caller say `stickyLeftCount={3}` and the menu just owns
   *  the on/off, while preserving the caller's preferred pin count. */
  pinCountWhenEnabled: number
  onChange: (next: Partial<ViewOptions>) => void
  onCopyViewUrl: () => void | Promise<void>
}) {
  const pinOn = (value.pinFirstColumns ?? 0) > 0
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="gap-1.5" title="Table view options">
          <IcoEye size={11} />
          View
          <IcoChevronDown size={10} className="text-[var(--text-muted)]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] surface-float">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Table view
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={!!value.compact}
          onCheckedChange={(v) => onChange({ compact: !!v })}
          onSelect={(e) => e.preventDefault()}
          className="text-[12px]"
        >
          Compact rows
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value.zebra !== false}
          onCheckedChange={(v) => onChange({ zebra: !!v })}
          onSelect={(e) => e.preventDefault()}
          className="text-[12px]"
        >
          Zebra stripes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={!!value.gridLines}
          onCheckedChange={(v) => onChange({ gridLines: !!v })}
          onSelect={(e) => e.preventDefault()}
          className="text-[12px]"
        >
          Grid lines
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={pinOn}
          onCheckedChange={(v) => onChange({ pinFirstColumns: v ? pinCountWhenEnabled : 0 })}
          onSelect={(e) => e.preventDefault()}
          className="text-[12px]"
        >
          Pin first columns
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => { void onCopyViewUrl() }}
          className="text-[12px]"
        >
          <IcoLink size={11} className="mr-1.5" />
          Copy view URL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Column filter popover — inline text input per column
   ═══════════════════════════════════════════════════════════════════ */

function ColumnFilterTrigger<T, V>({ column }: { column: Column<T, V> }) {
  const value = (column.getFilterValue() ?? '') as string
  const active = !!value
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter ${column.id}`}
          onClick={(e) => e.stopPropagation()}
          // Block dnd-kit pointerdown so opening the filter popover doesn't
          // accidentally start a column drag if the user moves slightly.
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center justify-center w-4 h-4 rounded transition-colors',
            active
              ? 'text-[var(--accent)]'
              : 'opacity-0 group-hover/header:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-dim)]'
          )}
          title={active ? `Filter: ${value}` : 'Filter column'}
        >
          <IcoFilter size={11} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[220px] p-2 bg-[var(--surface-2)] surface-float border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Filter {column.id}
          </label>
          <input
            value={value}
            onChange={(e) => column.setFilterValue(e.target.value)}
            placeholder="Contains…"
            className="w-full h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-bd)]"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">Case-insensitive match</span>
            {active && (
              <button
                onClick={() => column.setFilterValue('')}
                className="text-[10px] text-[var(--text-dim)] hover:text-[var(--negative)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Saved views menu
   ═══════════════════════════════════════════════════════════════════ */

function SavedViewsMenu({
  views,
  activeView,
  activeViewDirty,
  onApply,
  onSave,
  onUpdate,
  onReset,
  onDelete,
}: {
  views: SavedView[]
  activeView: string | null
  activeViewDirty: boolean
  onApply: (v: SavedView) => void
  onSave: (name: string) => void
  onUpdate: () => void
  onReset: () => void
  onDelete: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) { setNaming(false); setName('') }
  }, [open])

  const commitSave = () => {
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
      setNaming(false)
      setName('')
      setOpen(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="xs" className="gap-1.5" title={activeViewDirty ? `${activeView} (unsaved changes)` : (activeView ?? 'Views')}>
          <IcoBookmark size={11} />
          <span className="inline-flex items-center gap-1">
            {activeView ?? 'Views'}
            {activeViewDirty && (
              <span
                aria-label="unsaved changes"
                title="Unsaved changes — click Update to overwrite or Reset to discard"
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warning)]"
              />
            )}
          </span>
          <IcoChevronDown size={10} className="text-[var(--text-muted)]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px] surface-float">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Saved views
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-[var(--text-dim)]">No saved views yet.</div>
        )}
        {views.map((v) => (
          <DropdownMenuItem
            key={v.name}
            onSelect={() => onApply(v)}
            className="group/view flex items-center justify-between text-[12px]"
          >
            <span className={cn(activeView === v.name && 'text-[var(--accent)] font-semibold')}>
              {activeView === v.name && <span className="mr-1">●</span>}
              {v.name}
              {activeView === v.name && activeViewDirty && (
                <span className="ml-1.5 text-[10px] text-[var(--warning)]" title="Unsaved changes">●</span>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(v.name)
              }}
              className="opacity-0 group-hover/view:opacity-100 text-[var(--text-muted)] hover:text-[var(--negative)]"
              aria-label={`Delete view ${v.name}`}
            >
              <IcoClose size={11} />
            </button>
          </DropdownMenuItem>
        ))}
        {/* When the active view has been modified, surface quick "save changes
            to this view" + "discard my changes" affordances right below the
            list. Both only appear with an active view + dirty diff so the menu
            stays calm in the common case. */}
        {activeView && activeViewDirty && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); onUpdate(); setOpen(false) }}
              className="text-[12px] text-[var(--accent)]"
            >
              <IcoRotateCw size={11} className="mr-1.5" />
              Update “{activeView}”
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); onReset(); setOpen(false) }}
              className="text-[12px] text-[var(--text-dim)]"
            >
              <IcoRotateCcw size={11} className="mr-1.5" />
              Reset to “{activeView}”
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {naming ? (
          <div className="p-2 flex items-center gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitSave()
                else if (e.key === 'Escape') setNaming(false)
              }}
              placeholder="View name…"
              autoFocus
              className="flex-1 h-7 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent-bd)]"
            />
            <Button size="xs" variant="primary" onClick={commitSave}>Save</Button>
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); setNaming(true) }}
            className="text-[12px] text-[var(--accent)]"
          >
            <IcoPlus size={12} className="mr-1" />
            Save current as…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
