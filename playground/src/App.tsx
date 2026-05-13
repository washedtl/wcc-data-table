/**
 * Playground for wcc-data-table.
 *
 * This is a standalone Vite + React app that consumes the extracted package
 * source directly via the `@/` alias mapped to ../src. It simulates what a
 * "different project" would look like after the shadcn registry drops the
 * source files in. If this renders correctly, the extraction is proven.
 */
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, StatusChip } from '@/components/data-table'

type Sku = {
  id: string
  asin: string
  title: string
  supplier: string
  cost: number
  sell: number
  roi: number
  status: 'Done' | 'Pending' | 'Failed'
}

const DATA: Sku[] = [
  { id: '1', asin: 'B09XSHJPHF', title: 'Hydro Flask 32oz Wide Mouth Water Bottle',         supplier: 'Walmart', cost: 18.42, sell: 31.95, roi: 73.4, status: 'Done'    },
  { id: '2', asin: 'B0BRH1HK3W', title: 'Yeti Rambler 20oz Tumbler with Magslider Lid',     supplier: 'Target',  cost: 22.10, sell: 38.50, roi: 74.2, status: 'Done'    },
  { id: '3', asin: 'B07PVCVBN7', title: 'Stanley Adventure Quencher 40oz Travel Tumbler',   supplier: 'Costco',  cost: 27.80, sell: 49.95, roi: 79.7, status: 'Pending' },
  { id: '4', asin: 'B08LMNXP3K', title: 'Owala FreeSip 24oz Insulated Stainless Steel',     supplier: 'Walmart', cost: 14.20, sell: 27.95, roi: 96.8, status: 'Done'    },
  { id: '5', asin: 'B0CXSHJ4PF', title: 'Contigo Autoseal West Loop 16oz Travel Mug',       supplier: "Sam's",   cost: 11.80, sell: 22.50, roi: 90.6, status: 'Done'    },
  { id: '6', asin: 'B0DRTYU13K', title: 'Simple Modern Summit 32oz Insulated Water Bottle', supplier: 'Walmart', cost: 16.40, sell: 26.95, roi: 64.3, status: 'Failed'  },
  { id: '7', asin: 'B0BXLNK288', title: 'Iron Flask 32oz Sports Water Bottle',              supplier: 'Target',  cost: 13.95, sell: 24.50, roi: 75.6, status: 'Done'    },
  { id: '8', asin: 'B0DSP1ZQ4N', title: 'Takeya Originals Vacuum-Insulated 18oz',           supplier: 'Costco',  cost: 19.20, sell: 32.40, roi: 68.8, status: 'Pending' },
]

const fmtUsd = (n: number) => `$${n.toFixed(2)}`
const fmtPct = (n: number) => `${n.toFixed(1)}%`

const COLUMNS: ColumnDef<Sku, unknown>[] = [
  { id: 'asin', accessorKey: 'asin', header: 'ASIN',
    cell: c => <span className="font-mono text-xs">{c.getValue<string>()}</span>,
    size: 110 },
  { id: 'title', accessorKey: 'title', header: 'Title',
    cell: c => <span className="text-sm">{c.getValue<string>()}</span>,
    size: 360 },
  { id: 'supplier', accessorKey: 'supplier', header: 'Supplier', size: 110 },
  { id: 'cost', accessorKey: 'cost', header: 'Cost',
    cell: c => <span className="tabular-nums">{fmtUsd(c.getValue<number>())}</span>,
    meta: { tone: 'numeric' }, size: 90 },
  { id: 'sell', accessorKey: 'sell', header: 'Sell',
    cell: c => <span className="tabular-nums">{fmtUsd(c.getValue<number>())}</span>,
    meta: { tone: 'numeric' }, size: 90 },
  { id: 'roi', accessorKey: 'roi', header: 'ROI',
    cell: c => {
      const v = c.getValue<number>()
      const cls = v >= 75 ? 'text-[var(--positive)]' : v >= 50 ? 'text-[var(--accent)]' : 'text-[var(--warning)]'
      return <span className={`tabular-nums ${cls}`}>{fmtPct(v)}</span>
    },
    meta: { tone: 'numeric' }, size: 90 },
  { id: 'status', accessorKey: 'status', header: 'Status',
    cell: c => {
      const v = c.getValue<'Done' | 'Pending' | 'Failed'>()
      const tone = v === 'Done' ? 'positive' : v === 'Pending' ? 'warning' : 'negative'
      return <StatusChip label={v} tone={tone} />
    }, size: 110 },
]

export function App() {
  const [notifications, setNotifications] = useState<string[]>([])

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] p-8 text-[var(--text)]">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">wcc-data-table playground</h1>
          <p className="text-sm text-[var(--text-dim)] mt-1">
            Standalone Vite + React app consuming the extracted package source. If you see a working table
            below — column drag, resize, View menu, find bar (Ctrl+F), Tight/Auto/Roomy density — the
            extraction is fully functional.
          </p>
        </header>

        <DataTable<Sku>
          tableId="playground-default"
          columns={COLUMNS}
          data={DATA}
          rowKey={r => r.id}
          globalFilterPlaceholder="Filter by ASIN, title…"
          maxHeight={520}
          stickyLeftCount={1}
          showViewOptions
          onNotify={(msg, kind) => {
            console.log(`[notify:${kind}]`, msg)
            setNotifications(prev => [`${kind}: ${msg}`, ...prev].slice(0, 5))
          }}
        />

        {notifications.length > 0 && (
          <aside className="mt-4 p-3 bg-[var(--surface-2)] rounded-md border border-[var(--border)]">
            <h2 className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Notifications (last 5)
            </h2>
            <ul className="text-sm space-y-1">
              {notifications.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}
