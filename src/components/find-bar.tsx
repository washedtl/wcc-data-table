import { useEffect, useRef, useState, type JSX } from 'react'
import { cn } from '@/lib/cn'
import { IcoClose } from '@/lib/icons'

/* ═══════════════════════════════════════════════════════════════════
   FindBar
   ═══════════════════════════════════════════════════════════════════
   Cmd+F-summoned find bar. Controlled component:
     - parent owns `open`, `query`, optional `matchCount`/`matchIndex`
     - parent decides where it sits in the DOM (overlay, inline, etc.)
     - parent wires the query into whatever it filters (e.g. TanStack's
       globalFilter) — the bar itself does not filter.

   Why controlled: the find bar is meaningful only as a thin shell over
   parent state. Making it self-managing would force every consumer to
   subscribe to its query via context or a ref, which is more wiring
   than just lifting state up.

   Why 120ms debounce on the OUTGOING query (not the inner value): the
   input must feel instant — every keystroke updates the visible text.
   But the parent's filter pass is expensive on big tables (TanStack
   re-runs the column filter pipeline for every row). 120ms hits the
   "felt instantaneous" threshold while collapsing a typed word into
   roughly 1-2 filter passes instead of 5-8.
*/

export interface FindBarProps {
  /** When false the bar renders nothing. */
  open: boolean
  /** Called when the bar wants to close itself (Esc, × button). */
  onOpenChange: (open: boolean) => void
  /** Current query — drives the input's `value`. The parent reads
   *  `onQueryChange` (debounced) and applies it to its filter. */
  query: string
  /** Fired ~120ms after the last keystroke. Receives the full text
   *  that should be filtered on. */
  onQueryChange: (q: string) => void
  /** Total post-filter matches. When undefined the count UI hides. */
  matchCount?: number
  /** 1-based current-match position. 0 means "no current match" — the
   *  rendered count then shows just the total ("12 matches"). */
  matchIndex?: number
  /** Down-arrow / Enter inside input. Optional — when undefined the
   *  button hides. */
  onNext?: () => void
  /** Up-arrow / Shift+Enter inside input. Optional — when undefined
   *  the button hides. */
  onPrev?: () => void
  placeholder?: string
  /** Optional className on the outer wrapper for parents that want to
   *  override positioning (e.g. inline vs floating). Default styling
   *  positions the bar at the bottom-right of the nearest relatively
   *  positioned ancestor. */
  className?: string
}

const DEBOUNCE_MS = 120

export function FindBar({
  open,
  onOpenChange,
  query,
  onQueryChange,
  matchCount,
  matchIndex,
  onNext,
  onPrev,
  placeholder = 'Find in table…',
  className,
}: FindBarProps): JSX.Element | null {
  // Local mirror of `query` so the input updates immediately on every
  // keystroke. The debounced effect below is what fires onQueryChange.
  const [localValue, setLocalValue] = useState(query)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Track the last value we emitted so we don't send a duplicate
  // onQueryChange when the parent's `query` syncs back into us.
  const lastEmittedRef = useRef(query)

  // When the parent changes `query` externally (e.g. clears it on Esc
  // cascade), reflect that in the input. Skip if the change is just
  // our own debounced emission echoing back.
  useEffect(() => {
    if (query !== lastEmittedRef.current) {
      setLocalValue(query)
      lastEmittedRef.current = query
    }
  }, [query])

  // Autofocus + select on open. Re-runs on `open` rising edge.
  useEffect(() => {
    if (!open) return
    // requestAnimationFrame so the focus happens after the input is
    // mounted and visible — focusing during the same frame as mount
    // can no-op when the element is still being laid out.
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Debounced emission of the local value to the parent.
  useEffect(() => {
    if (!open) return
    if (localValue === lastEmittedRef.current) return
    const id = window.setTimeout(() => {
      lastEmittedRef.current = localValue
      onQueryChange(localValue)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [localValue, open, onQueryChange])

  if (!open) return null

  const close = () => {
    // Only emit a clear when there's actually a query to clear. The
    // previous unconditional `onQueryChange('')` fired a spurious filter
    // change every time the user opened+closed the bar without typing —
    // which on the SAS table triggers a TanStack filter pass for 2000+
    // rows.
    const hadQuery = localValue !== '' || lastEmittedRef.current !== ''
    setLocalValue('')
    lastEmittedRef.current = ''
    if (hadQuery) onQueryChange('')
    onOpenChange(false)
  }

  // Format the count chip. Prefer "N of M" when we have a current
  // index; fall back to just M when we don't. Hide entirely when
  // matchCount is undefined (caller didn't supply counts).
  let countText: string | null = null
  if (typeof matchCount === 'number') {
    if (matchCount === 0) countText = 'No matches'
    else if (matchIndex && matchIndex > 0) countText = `${matchIndex} of ${matchCount}`
    else countText = `${matchCount} match${matchCount === 1 ? '' : 'es'}`
  }

  // Buttons: 28px hit-area floor (min-w-7 min-h-7) per project rule.
  // No ::before pseudo-extension — real square targets only.
  const btnBase = cn(
    'inline-flex items-center justify-center',
    'min-w-7 min-h-7 rounded-md',
    'text-[var(--text-dim)] hover:text-[var(--text)]',
    'hover:bg-[var(--surface-2)]',
    'transition-[color,background-color] duration-150',
    'disabled:opacity-40 disabled:hover:bg-transparent',
  )

  return (
    <div
      role="search"
      aria-label="Find in table"
      className={cn(
        // Default placement: bottom-right of nearest relatively-positioned
        // ancestor. Fixed `bottom-3 right-3` would clip on tables that
        // are themselves scrolled inside a panel. Absolute lets the
        // parent decide via its own positioning context.
        'absolute bottom-3 right-3 z-40',
        'flex items-center gap-1.5 px-2 py-1.5',
        'rounded-[var(--radius-md)]',
        'bg-[var(--surface-2)] border border-[var(--border)]',
        'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]',
        className,
      )}
      onKeyDown={(e) => {
        // Local key handling for the find bar input. We stopPropagation
        // on every consumed key so the parent's keydown listener (e.g.
        // DataTable's root onKeyDown) doesn't double-process Esc/Enter
        // and reach into globalFilter/selection state we already own.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          if (e.shiftKey) onPrev?.()
          else onNext?.()
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          onNext?.()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          onPrev?.()
          return
        }
      }}
    >
      <input
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-[200px] h-7 px-2 rounded-[var(--radius-sm)]',
          'border border-[var(--border)] bg-[var(--bg)]',
          'text-[12px] text-[var(--text)]',
          'placeholder:text-[var(--text-muted)]',
          'focus:outline-none focus:border-[var(--accent-bd)]',
        )}
      />

      {countText && (
        <span
          className="px-1.5 text-[11px] mono tabular-nums text-[var(--text-dim)] whitespace-nowrap"
          aria-live="polite"
        >
          {countText}
        </span>
      )}

      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          disabled={!matchCount}
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
          className={btnBase}
        >
          <span aria-hidden className="text-[12px] leading-none">↑</span>
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!matchCount}
          aria-label="Next match"
          title="Next match (Enter)"
          className={btnBase}
        >
          <span aria-hidden className="text-[12px] leading-none">↓</span>
        </button>
      )}

      <button
        type="button"
        onClick={close}
        aria-label="Close find bar"
        title="Close (Esc)"
        className={btnBase}
      >
        <IcoClose size={12} />
      </button>
    </div>
  )
}
