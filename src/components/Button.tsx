import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "dark" | "outline" | "quiet";
type Size = "sm" | "md" | "lg";

/**
 * `lift` (see globals.css) carries BOTH the colour transition and the hover
 * rise, and is the only transition on a button. It is not paired with
 * Tailwind's `transition-colors`: two `transition-property` declarations on
 * one element means one of them wins and the other quietly does nothing.
 *
 * The rise itself is gated on a real hovering pointer inside that class, so
 * a tap on a phone reads as a press rather than sticking in a hover state.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-slab border-2 font-bold uppercase tracking-wide " +
  "lift " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // The accent. Dark text on amber — never white, the contrast fails.
  primary:
    "border-hivis bg-hivis text-slab-900 hover:border-hivis-dark hover:bg-hivis-dark",
  dark: "border-slab-900 bg-slab-900 text-slab-50 hover:bg-slab-800",
  outline:
    "border-slab-900 bg-transparent text-slab-900 hover:bg-slab-900 hover:text-slab-50",
  quiet:
    "border-slab-300 bg-white text-slab-700 hover:border-slab-500 hover:text-slab-900",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  // 48px min target — thumb-sized on a phone.
  lg: "px-6 py-3.5 text-base min-h-12",
};

function classes(variant: Variant, size: Size, full: boolean, extra?: string) {
  return [
    base,
    variants[variant],
    sizes[size],
    full ? "w-full" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface SharedProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...rest
}: SharedProps & ComponentProps<"button">) {
  return (
    <button
      className={classes(variant, size, fullWidth, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...rest
}: SharedProps & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </Link>
  );
}
