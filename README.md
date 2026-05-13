# wcc-data-table

A high-density, virtualized, drag-reorderable React table. Extracted from the
Washed Command Center's SAS canonical table — the same component handles
~7,000 rows with column drag/resize/pin, saved views, find-bar, density
toggles, per-column filters, and a row-pinning system.

Source-only distribution (shadcn-style). Drop the files into your project,
keep them, customize them.

![screenshot — playground](https://placeholder.invalid/wcc-data-table.png)

## What you get

- **Virtualized rows** — TanStack Virtual; smooth scroll on 5K+ rows
- **Drag-reorder + resize + sticky-pin columns** — dnd-kit + CSS sticky
- **Saved views** — name a layout (visible columns, sort, density, filters), persists per-browser, round-trips via `?view=` URL
- **Find bar** (Ctrl+F) — overlay with N-of-M match count + ↑↓ navigation
- **Density toggle** — Tight / Auto / Roomy
- **View menu** — Compact rows / Zebra stripes / Grid lines / Pin first columns / Copy view URL
- **Column-visibility menu** with cross-table sync (opt-in)
- **Per-column filter popovers** + global filter input
- **Row pinning** — click pin icon to anchor any row to the top
- **Row selection** + bulk-actions overlay bar
- **Keyboard navigation** — j/k cursor, Shift-click range select, Ctrl+C copy IDs
- **Right-click context menu** per row (via Radix)
- **Detail-drawer slide-out** — Sheet on the right, optional
- **Empty / loading / pinned-row states** built in

## Install

### With shadcn CLI (recommended)

```bash
npx shadcn@latest add https://raw.githubusercontent.com/<owner>/wcc-data-table/main/registry/data-table.json
```

The CLI will:

1. Fetch every file listed in `registry/data-table.json`
2. Drop them into your project (`src/components/ui/`, `src/hooks/`, `src/lib/`, `src/styles/`)
3. `npm install` the peer deps automatically
4. Append the CSS tokens to your global stylesheet

### Manual install

1. Copy the contents of `src/` into your project, preserving folder structure:
   ```
   src/components/data-table.tsx       → src/components/ui/data-table.tsx
   src/components/find-bar.tsx         → src/components/ui/find-bar.tsx
   src/components/ui/*                 → src/components/ui/
   src/hooks/use-table-prefs.ts        → src/hooks/use-table-prefs.ts
   src/hooks/cross-table-vis.ts        → src/hooks/cross-table-vis.ts
   src/lib/cn.ts                       → src/lib/cn.ts
   src/lib/icons.tsx                   → src/lib/icons.tsx
   src/styles/data-table.css           → src/styles/data-table.css
   ```
2. Install peer deps:
   ```bash
   npm install @tanstack/react-table @tanstack/react-virtual \
     @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
     radix-ui class-variance-authority clsx lucide-react tailwind-merge
   ```
3. Import the tokens CSS once (in your `src/index.css` or equivalent):
   ```css
   @import "./styles/data-table.css";
   ```
4. Confirm your `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }` (shadcn-standard).

## Peer deps

| Package | Why |
|---|---|
| `@tanstack/react-table` ≥ 8.21 | The table engine |
| `@tanstack/react-virtual` ≥ 3.13 | Row virtualization for 5K+ row tables |
| `@dnd-kit/core` ≥ 6.3, `@dnd-kit/sortable` ≥ 10, `@dnd-kit/utilities` ≥ 3.2 | Column drag-reorder |
| `radix-ui` ≥ 1.4 | Dropdown / context / popover / dialog primitives (meta package) |
| `class-variance-authority` ≥ 0.7 | Button variants |
| `clsx` ≥ 2.1 | Class composition |
| `lucide-react` ≥ 0.400 | Icons (Filter, ChevronDown, X, Plus, Pin, GripVertical, Columns3, Bookmark, RotateCw/Ccw, Eye, Link) |
| `tailwind-merge` ≥ 3.0 | Tailwind class deduplication |

React ≥ 18, Tailwind v4 assumed.

## Quick start

```tsx
import { DataTable, StatusChip } from "@/components/ui/data-table"
import type { ColumnDef } from "@tanstack/react-table"

type Sku = {
  id: string
  asin: string
  title: string
  cost: number
  status: "Done" | "Pending" | "Failed"
}

const data: Sku[] = [/* ... */]

const columns: ColumnDef<Sku, unknown>[] = [
  { id: "asin", accessorKey: "asin", header: "ASIN", size: 110 },
  { id: "title", accessorKey: "title", header: "Title", size: 360 },
  {
    id: "cost", accessorKey: "cost", header: "Cost",
    cell: c => <span className="tabular-nums">${c.getValue<number>().toFixed(2)}</span>,
    meta: { tone: "numeric" }, size: 90,
  },
  {
    id: "status", accessorKey: "status", header: "Status",
    cell: c => {
      const v = c.getValue<"Done" | "Pending" | "Failed">()
      const tone = v === "Done" ? "positive" : v === "Pending" ? "warning" : "negative"
      return <StatusChip label={v} tone={tone} />
    },
    size: 110,
  },
]

export function MyTable() {
  return (
    <DataTable<Sku>
      tableId="my-table"               // localStorage key for prefs
      columns={columns}
      data={data}
      rowKey={r => r.id}
      globalFilterPlaceholder="Filter…"
      maxHeight={520}
      showViewOptions                  // adds Compact/Zebra/Grid/Pin/Copy-URL menu
      onNotify={(msg, kind) => console.log(`[${kind}]`, msg)}
    />
  )
}
```

## DataTable props

The 40+ props grouped by concern.

### Required

| Prop | Type | Notes |
|---|---|---|
| `columns` | `ColumnDef<T, unknown>[]` | Standard TanStack column defs. Use `meta.tone: "numeric" \| "center"` for cell alignment; `meta.defaultHidden: true` to hide a column by default. |
| `data` | `T[]` | Row data. |
| `rowKey` | `(row: T) => string` | Stable identity per row. Used for selection, pinning, keyboard cursor. |

### Persistence

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tableId` | `string` | — | Required to persist prefs (column sizing, density, sort, filters, view options, saved views, pinning) under `wcc.table.<id>` in localStorage. Omit for an ephemeral table. |
| `density` | `"compact" \| "default" \| "relaxed"` | — | Controlled mode. Omit + use `defaultDensity` for uncontrolled. |
| `defaultDensity` | `TableDensity` | `"default"` | Initial density when uncontrolled. |
| `defaultColumnVisibility` | `VisibilityState` | — | Force-apply visibility on mount + when re-keyed. Wins over `meta.defaultHidden`; loses to saved-view prefs. |

### Chrome toggles

| Prop | Type | Default | Notes |
|---|---|---|---|
| `showColumnMenu` | `boolean` | `true` | Toolbar "Columns" dropdown (toggle visibility). |
| `showDensityToggle` | `boolean` | `true` | Toolbar Tight/Auto/Roomy tabs. |
| `showGlobalFilter` | `boolean` | `true` | Toolbar text-search input. |
| `showViewsMenu` | `boolean` | `true` | Toolbar saved-views dropdown (save/load named layouts). Requires `tableId`. |
| `showViewOptions` | `boolean` | `true` | Toolbar View dropdown (Compact/Zebra/Grid lines/Pin/Copy URL). |
| `verticalRules` | `boolean` | `false` | Vertical separator borders between columns (initial default; overridden by the View menu once set). |
| `zebra` | `boolean` | `true` | Alternating-row tint (initial default). |
| `tallHeader` | `boolean` | `false` | Bump header padding to `py-3` regardless of density. |
| `liftedHeader` | `boolean` | `false` | Give thead a `--surface-2` background (use when table sits in a darker region). |

### Layout

| Prop | Type | Default | Notes |
|---|---|---|---|
| `maxHeight` | `number` | `560` | Caps the scroll container in px. |
| `fillHeight` | `boolean` | `false` | Override `maxHeight` and fill the parent's flex space. Parent must be a bounded flex container. |
| `estimateRowHeight` | `number` | density-derived | Px per row for virtualization. Set explicitly to override compact (40) or normal (88). |
| `stickyLeftCount` | `number` | `0` | Pin first N columns to the left edge via CSS sticky. The View menu's "Pin first columns" toggle uses this as the "on" count. |

### Behavior

| Prop | Type | Notes |
|---|---|---|
| `loading` | `boolean` | Renders 6 skeleton rows when true. |
| `emptyState` | `ReactNode` | Override the default empty-state block. |
| `toolbar` | `ReactNode` | Extra elements rendered in the toolbar row (between filter input and built-in menus). |
| `globalFilterPlaceholder` | `string` | Placeholder for the search input. |
| `bulkActions` | `(ctx: BulkActionCtx<T>) => ReactNode` | When the user selects ≥1 row, the toolbar morphs into a bulk-actions bar; this returns its buttons. `ctx.selected` is the selected rows; `ctx.clear()` deselects all. |
| `enableColumnReorder` | `boolean` (default `true`) | Drag column headers to reorder. |
| `enableColumnFilters` | `boolean` (default `true`) | Per-column filter popover (funnel icon in each header). |
| `enableRowPinning` | `boolean` (default `true`) | Click the pin column to anchor a row to the top. |
| `syncColumnsByLabel` | `boolean` | When `true`, column visibility syncs across every other table that also opts in, keyed by column LABEL (so "Buy" hides in both SAS and Keepa). Uses `src/hooks/cross-table-vis.ts`. |
| `findBarEnabled` | `boolean` (default `true`) | Ctrl+F summons a floating find-bar overlay with match-count + ↑↓ navigation. |

### Events

| Prop | Type | Notes |
|---|---|---|
| `onRowClick` | `(row: T) => void` | Left-click on a row. |
| `onRowDoubleClick` | `(row: T) => void` | Double-click. Fires regardless of selection state. |
| `onRowMiddleClick` | `(row: T) => void` | Middle-click (typically open in new tab). |
| `rowContextMenu` | `(ctx: RowContextMenuCtx<T>) => ReactNode` | Right-click menu items per row. `ctx.isInSelection` lets you switch between bulk and single-row actions. |
| `onKeyboardCommand` | `(cmd, ctx) => void` | Escape hatch for caller-defined key commands beyond j/k/Shift. |
| `detailRenderer` | `(row: T) => { title?, description?, content }` | Click-to-open a right-side Sheet drawer with row detail. Overrides `onRowClick`. |
| `onNotify` | `(message, kind) => void` | Transient feedback hook (e.g. "Copied N IDs" on Ctrl+C, "View URL copied" from the View menu). Wire to your toast lib. If omitted, feedback is dropped. |
| `rowClassName` | `(row: T) => string \| null` | Per-row class override (status-driven accents, etc.). |

## Theming

The package ships with dark-default tokens in `src/styles/data-table.css`. Override
any token after the import:

```css
@import "./styles/data-table.css";

/* Swap the accent — every accent-derived token (-dim, -bd, etc.) recomputes
 * via color-mix. */
:root {
  --accent: #FF4D5E;        /* now hot-pink instead of blue */
  --accent-fg: #FFFFFF;
}

/* Light mode — flip the surface stack. */
:root {
  --bg: #FFFFFF;
  --surface: #F7F7F8;
  --surface-2: #EFEFF1;
  --border: #E4E4E7;
  --border-strong: #D4D4D8;
  --text: #0A0A0F;
  --text-dim: #5A5E66;
  --text-muted: #9EA1A8;
}
```

The shadcn registry pre-includes a light variant in `cssVars` — `npx shadcn add` will offer both.

## Saved views + URL share

When `tableId` is set, the table persists:

- Column sizing
- Column visibility + order
- Sort + filter state
- Density + view-options (compact/zebra/grid/pin)
- Saved named views ("My Layout", "Wide", etc.)

All under `wcc.table.<tableId>` in localStorage.

The **Copy view URL** action (View menu) writes an `?view=<base64>` URL to the
clipboard. When another user opens that URL, the encoded prefs are applied
synchronously before the first paint — they see your exact layout.

### Sharing across devices

The package is intentionally localStorage-only. To sync across devices, wrap
the hook:

```ts
import { useTablePrefs } from "@/hooks/use-table-prefs"

export function useServerSyncedTablePrefs(tableId: string) {
  const [prefs, setPrefs] = useTablePrefs(tableId)

  // On mount: fetch your-backend → merge into prefs
  useEffect(() => { /* GET your endpoint, setPrefs(...) */ }, [tableId])

  // On change: debounced PUT
  useEffect(() => { /* PUT your endpoint with prefs.views + prefs.activeView */ }, [prefs.views])

  return [prefs, setPrefs] as const
}
```

## Cross-table column-visibility sync

Optional. When two tables on the same page opt in via `syncColumnsByLabel`,
toggling "Buy" off in table A also hides "Buy" in table B (matched by column
label, not id, so even tables with different column id schemes line up).

Implemented in `src/hooks/cross-table-vis.ts` as a module-level event bus.
Safe to omit if not needed.

## License

MIT. See [LICENSE](./LICENSE).

## Roadmap / known gaps

- No built-in column resize handle styling polish — works but minimal
- No built-in CSV export (intentional — callers know their domain better)
- Saved views are per-browser only; cross-device requires wrapping the hook (see above)
- Light-mode tokens included in the shadcn registry but not yet visually polished
- Pre-existing IDE lint warnings inherited from the source (inline styles, missing button types) — not regressions, just minor cleanup deferred
