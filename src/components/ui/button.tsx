import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/cn"

const buttonVariants = cva(
  cn(
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap outline-none",
    "transition-[background,color,box-shadow,transform,filter] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        // ── Canonical tones ──
        default:
          "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--surface-2)_70%,var(--accent))] hover:text-[var(--text)]",
        primary:
          cn(
            "text-[#0D0D0F] btn-lift",
            "bg-[linear-gradient(180deg,var(--accent),color-mix(in_srgb,var(--accent)_82%,var(--bg)))]",
            "shadow-[inset_0_1px_0_color-mix(in_srgb,white_22%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
            "hover:brightness-110 hover:-translate-y-[1px]",
            "hover:shadow-[inset_0_1px_0_color-mix(in_srgb,white_28%,transparent),0_4px_16px_-2px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
          ),
        success:
          cn(
            "text-[#0D0D0F]",
            "bg-[linear-gradient(180deg,var(--positive),color-mix(in_srgb,var(--positive)_82%,var(--bg)))]",
            "shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--positive)_55%,transparent)]",
            "hover:brightness-110 hover:-translate-y-[1px]"
          ),
        destructive:
          cn(
            "text-[#0D0D0F]",
            "bg-[linear-gradient(180deg,var(--negative),color-mix(in_srgb,var(--negative)_82%,var(--bg)))]",
            "shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--negative)_55%,transparent)]",
            "hover:brightness-110 hover:-translate-y-[1px]"
          ),
        warning:
          cn(
            "text-[#0D0D0F]",
            "bg-[linear-gradient(180deg,var(--warning),color-mix(in_srgb,var(--warning)_82%,var(--bg)))]",
            "shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--warning)_55%,transparent)]",
            "hover:brightness-110 hover:-translate-y-[1px]"
          ),
        // Tinted — subtle tone but still branded
        tinted:
          "bg-[var(--accent-dim)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-bd)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
        outline:
          "bg-[var(--bg)] text-[var(--text-dim)] shadow-[inset_0_0_0_1px_var(--border-strong),0_1px_0_color-mix(in_srgb,black_25%,transparent)] hover:bg-[var(--surface)] hover:text-[var(--text)] hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent),0_1px_0_color-mix(in_srgb,black_30%,transparent)]",
        "destructive-outline":
          "bg-[var(--bg)] text-[var(--negative)] shadow-[inset_0_0_0_1px_var(--border-strong),0_1px_0_color-mix(in_srgb,black_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--negative)_8%,var(--bg))] hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--negative)_32%,transparent),0_1px_0_color-mix(in_srgb,black_30%,transparent)]",
        ghost:
          "bg-transparent text-[var(--text-dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
        link:
          "bg-transparent text-[var(--accent)] underline-offset-4 hover:underline hover:brightness-110 h-auto px-0",
        secondary:
          "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--surface-2)_70%,var(--accent))]",

        // ── Legacy aliases (mapped to canonical tones above) ──
        green:  "bg-[linear-gradient(180deg,var(--positive),color-mix(in_srgb,var(--positive)_82%,var(--bg)))] text-[#0D0D0F] hover:brightness-110 hover:-translate-y-[1px] shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--positive)_55%,transparent)]",
        red:    "bg-[linear-gradient(180deg,var(--negative),color-mix(in_srgb,var(--negative)_82%,var(--bg)))] text-[#0D0D0F] hover:brightness-110 hover:-translate-y-[1px] shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--negative)_55%,transparent)]",
        yellow: "bg-[linear-gradient(180deg,var(--warning),color-mix(in_srgb,var(--warning)_82%,var(--bg)))] text-[#0D0D0F] hover:brightness-110 hover:-translate-y-[1px] shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--warning)_55%,transparent)]",
        blue:   "bg-[linear-gradient(180deg,var(--accent),color-mix(in_srgb,var(--accent)_82%,var(--bg)))] text-[#0D0D0F] hover:brightness-110 hover:-translate-y-[1px] shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--accent)_55%,transparent)]",
        teal:   "bg-[var(--accent-dim)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-bd)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
        purple: "bg-[var(--accent-dim)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-bd)] hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
        pink:   "bg-[linear-gradient(180deg,var(--negative),color-mix(in_srgb,var(--negative)_82%,var(--bg)))] text-[#0D0D0F] hover:brightness-110 hover:-translate-y-[1px] shadow-[inset_0_1px_0_color-mix(in_srgb,white_20%,transparent),0_1px_10px_-2px_color-mix(in_srgb,var(--negative)_55%,transparent)]",
      },
      size: {
        default: "h-9 px-4 py-2 text-[13px] has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[12px] has-[>svg]:px-2.5",
        md: "h-9 px-4 py-2 text-[13px] has-[>svg]:px-3",
        lg: "h-10 rounded-lg px-5 text-[13px] has-[>svg]:px-4",
        xl: "h-11 rounded-lg px-6 text-[14px] has-[>svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        "icon-xl": "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Shared per-variant CSS var so effects auto-color from the button tone. */
const TONE_VAR_CLASSES = cn(
  "[--fx-color:var(--accent)]",
  "data-[variant=success]:[--fx-color:var(--positive)]",
  "data-[variant=destructive]:[--fx-color:var(--negative)]",
  "data-[variant=warning]:[--fx-color:var(--warning)]",
  "data-[variant=green]:[--fx-color:var(--positive)]",
  "data-[variant=red]:[--fx-color:var(--negative)]",
  "data-[variant=yellow]:[--fx-color:var(--warning)]",
  "data-[variant=pink]:[--fx-color:var(--negative)]"
)

/** Scale + glow-on-hover modifier. */
const GLOW_CLASSES = cn(
  "hover:translate-y-0 hover:scale-[1.04]",
  "hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--fx-color)_35%,transparent),0_8px_28px_-4px_color-mix(in_srgb,var(--fx-color)_55%,transparent),0_2px_0_color-mix(in_srgb,black_30%,transparent)]",
  "focus-visible:scale-[1.04]"
)

/** Slide-up fill — bg slides in from the bottom on hover. Best on
 *  outline / ghost variants (the fill replaces the transparent bg). */
const SLIDE_UP_CLASSES = cn(
  "relative overflow-hidden isolate",
  // The sliding fill layer
  "after:content-[''] after:absolute after:inset-0 after:-z-10 after:translate-y-full",
  "after:bg-[var(--fx-color)] after:transition-transform after:duration-500 after:ease-out",
  "hover:after:translate-y-0",
  // Label flips to on-bg color once the fill arrives
  "hover:text-[#0D0D0F] hover:translate-y-0 hover:scale-[1.03]",
  "focus-visible:scale-[1.03]"
)

/** Animated border — blurred tone halo fades in around the button and
 *  the border picks up the tone. Pure CSS, no JS animation required. */
const ANIMATED_BORDER_CLASSES = cn(
  "relative overflow-visible isolate",
  // Outer blur halo on hover (sits behind the button)
  "before:content-[''] before:absolute before:-inset-px before:rounded-[inherit] before:-z-10",
  "before:opacity-0 before:transition-opacity before:duration-300 before:blur-[6px]",
  "before:bg-[linear-gradient(45deg,var(--fx-color),color-mix(in_srgb,var(--fx-color)_40%,transparent),var(--fx-color),color-mix(in_srgb,var(--fx-color)_40%,transparent))]",
  "before:bg-[length:300%_300%]",
  "hover:before:opacity-70 hover:before:animate-[border-sheen_2.5s_linear_infinite]",
  // Inner ring + inner glow on hover
  "hover:shadow-[inset_0_0_0_1px_var(--fx-color),inset_0_0_20px_-4px_color-mix(in_srgb,var(--fx-color)_35%,transparent)]",
  "hover:translate-y-0 hover:scale-[1.03]",
  "focus-visible:scale-[1.03]"
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  glow = false,
  slideUp = false,
  animatedBorder = false,
  loading = false,
  disabled: disabledProp,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Scale + colored glow on hover. Pairs with any variant. */
    glow?: boolean
    /** Background slides up from the bottom on hover (best on outline/ghost). */
    slideUp?: boolean
    /** Blurred tone halo fades in around the button on hover. */
    animatedBorder?: boolean
    /** Hide children + show centered spinner. Auto-disables the button. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const hasFx = glow || slideUp || animatedBorder
  const isDisabled = Boolean(loading || disabledProp)

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "" : undefined}
      disabled={isDisabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(
        buttonVariants({ variant, size, className }),
        hasFx && TONE_VAR_CLASSES,
        glow && GLOW_CLASSES,
        slideUp && SLIDE_UP_CLASSES,
        animatedBorder && ANIMATED_BORDER_CLASSES,
        loading && "relative",
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">
            {children}
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2
              className="animate-spin"
              aria-label="Loading"
              data-slot="button-loading-indicator"
            />
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
