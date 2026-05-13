import { cn } from '@/lib/cn'

export interface SegmentOption<V extends string = string> {
  value: V
  label: string
}

interface SegmentedControlProps<V extends string = string> {
  value: V
  onChange: (next: V) => void
  options: readonly SegmentOption<V>[]
  className?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<V extends string = string>({
  value, onChange, options, className, size = 'md',
}: SegmentedControlProps<V>) {
  const h = size === 'sm' ? 'h-7 text-[11px]' : 'h-8 text-[12px]'
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-0.5 gap-0.5',
        h,
        className
      )}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 h-full rounded-[var(--radius-sm)] transition-colors font-medium',
              'text-[var(--text-dim)] hover:text-[var(--text)]',
              active && 'bg-[var(--accent-dim)] text-[var(--accent)]'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
