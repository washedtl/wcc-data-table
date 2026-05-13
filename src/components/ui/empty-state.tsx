import type { ReactNode, FC } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: FC<{ size?: number; className?: string }>
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-16 px-8',
        'border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface)]/50',
        className
      )}
    >
      {Icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
          <Icon size={22} className="text-[var(--text-dim)]" />
        </div>
      )}
      <div className="font-[var(--font-display)] text-[18px] font-semibold text-[var(--text)]">{title}</div>
      {body && <div className="text-[13px] text-[var(--text-dim)] max-w-[460px] leading-relaxed">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
