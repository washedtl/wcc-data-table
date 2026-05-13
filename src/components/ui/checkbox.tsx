import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

/* ═══════════════════════════════════════════════════════════════════
   Checkbox — colored variants (anubra266 pattern) on radix primitive.
   Tone flows from --check-color CSS var set per variant, so filled +
   outline states both match. Size xs/sm/md for tight/dense UIs.
   ═══════════════════════════════════════════════════════════════════ */

const checkboxVariants = cva(
  cn(
    "peer shrink-0 rounded-[4px] border border-border shadow-xs outline-none",
    "transition-[background,border-color,box-shadow,transform] duration-150",
    "focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--check-color)_35%,transparent)]",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "data-[state=checked]:bg-[var(--check-color)] data-[state=checked]:border-[var(--check-color)]",
    "data-[state=indeterminate]:bg-[var(--check-color)] data-[state=indeterminate]:border-[var(--check-color)]",
    "active:scale-95",
    "aria-invalid:border-[var(--negative)] aria-invalid:ring-[color-mix(in_srgb,var(--negative)_35%,transparent)]"
  ),
  {
    variants: {
      color: {
        accent:   "[--check-color:var(--accent)] border-[var(--border-strong)] hover:border-[color-mix(in_srgb,var(--accent)_50%,var(--border-strong))]",
        success:  "[--check-color:var(--positive)] border-[var(--border-strong)] hover:border-[color-mix(in_srgb,var(--positive)_50%,var(--border-strong))]",
        warning:  "[--check-color:var(--warning)] border-[var(--border-strong)] hover:border-[color-mix(in_srgb,var(--warning)_50%,var(--border-strong))]",
        danger:   "[--check-color:var(--negative)] border-[var(--border-strong)] hover:border-[color-mix(in_srgb,var(--negative)_50%,var(--border-strong))]",
        neutral:  "[--check-color:var(--text-dim)] border-[var(--border-strong)] hover:border-[color-mix(in_srgb,var(--text-dim)_80%,var(--border-strong))]",
      },
      size: {
        xs: "size-3.5",
        sm: "size-4",
        md: "size-5",
      },
    },
    defaultVariants: {
      color: "accent",
      size: "sm",
    },
  }
)

const ICON_SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "size-2.5",
  sm: "size-3",
  md: "size-3.5",
}

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "color">,
    VariantProps<typeof checkboxVariants> {}

function Checkbox({
  className,
  color = "accent",
  size = "sm",
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-color={color ?? "accent"}
      className={cn(checkboxVariants({ color, size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-[#0D0D0F]"
      >
        {props.checked === "indeterminate" ? (
          <MinusIcon className={ICON_SIZE[size ?? "sm"]} strokeWidth={3} />
        ) : (
          <CheckIcon className={ICON_SIZE[size ?? "sm"]} strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
