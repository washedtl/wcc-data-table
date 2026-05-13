import { useMemo } from 'react'
import { cn } from '@/lib/cn'

export type SparklineTone = 'positive' | 'negative' | 'info' | 'neutral'

const STROKE: Record<SparklineTone, string> = {
  positive: 'var(--positive)',
  negative: 'var(--negative)',
  info:     'var(--accent)',
  neutral:  'var(--text-dim)',
}

interface SparklineProps {
  values: number[]
  tone?: SparklineTone
  width?: number
  height?: number
  strokeWidth?: number
  glow?: boolean
  className?: string
}

export function Sparkline({
  values,
  tone = 'info',
  width = 72,
  height = 20,
  strokeWidth = 1.4,
  glow = false,
  className,
}: SparklineProps) {
  const points = useMemo(() => {
    if (!values.length) return ''
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const span = max - min || 1
    return values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width
      const y = height - ((v - min) / span) * (height - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [values, width, height])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('align-middle', className)}
      style={{ opacity: 0.9 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={glow ? { filter: `drop-shadow(0 0 3px ${STROKE[tone]})` } : undefined}
      />
    </svg>
  )
}
