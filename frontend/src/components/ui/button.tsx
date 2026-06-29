import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Pearl bubble primary
        default:
          "rounded-full bg-gradient-to-br from-white/90 to-blue-200/80 text-[#0a1e40] " +
          "shadow-[0_4px_20px_rgba(150,200,255,0.35),0_2px_6px_rgba(255,255,255,0.18),inset_0_1px_0_rgba(255,255,255,0.80)] " +
          "hover:shadow-[0_6px_28px_rgba(150,200,255,0.52),inset_0_1px_0_rgba(255,255,255,0.90)] " +
          "hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_10px_rgba(150,200,255,0.28)]",

        // Destructive — red with gloss
        destructive:
          "rounded-full bg-gradient-to-br from-red-400/90 to-red-600/85 text-white " +
          "shadow-[0_4px_16px_rgba(239,68,68,0.30),inset_0_1px_0_rgba(255,255,255,0.28)] " +
          "hover:shadow-[0_6px_24px_rgba(239,68,68,0.45)] hover:-translate-y-0.5",

        // Frosted outline
        outline:
          "rounded-full border border-blue-300/50 bg-blue-50/60 text-blue-800/80 " +
          "backdrop-blur-sm " +
          "hover:border-blue-400/70 hover:bg-blue-100/70 hover:text-blue-900",

        // Subtle frosted secondary
        secondary:
          "rounded-full border border-blue-200/40 bg-blue-50/50 text-blue-700/80 " +
          "backdrop-blur-sm " +
          "hover:border-blue-300/60 hover:bg-blue-100/60 hover:text-blue-900",

        // Ghost — no border
        ghost:
          "rounded-full bg-transparent text-blue-700/70 " +
          "hover:bg-blue-100/50 hover:text-blue-900",

        // Link
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-800 rounded-sm",
      },
      size: {
        default: "min-h-9 px-5 py-2",
        sm:      "min-h-8 px-4 py-1.5 text-xs",
        lg:      "min-h-10 px-8 py-2.5 text-base",
        icon:    "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
