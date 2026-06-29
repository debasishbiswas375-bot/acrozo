import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 hover-elevate",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-br from-white/85 to-blue-200/75 text-[#0a1e40] " +
          "shadow-[0_2px_10px_rgba(150,200,255,0.28),inset_0_1px_0_rgba(255,255,255,0.7)]",
        secondary:
          "border-blue-200/15 bg-blue-100/[0.07] text-blue-100/70 backdrop-blur-sm",
        destructive:
          "border-transparent bg-gradient-to-br from-red-400/80 to-red-600/70 text-white " +
          "shadow-[0_2px_8px_rgba(239,68,68,0.25)]",
        outline:
          "text-blue-100/75 border border-blue-200/[0.18] bg-blue-100/[0.04]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
