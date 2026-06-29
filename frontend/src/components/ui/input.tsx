import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-xl border bg-blue-100/[0.04] px-3 py-1 text-sm text-foreground",
        "border-blue-200/[0.14] placeholder:text-muted-foreground",
        "shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]",
        "backdrop-blur-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-200/40",
        "focus-visible:border-blue-200/35 focus-visible:bg-blue-100/[0.07]",
        "focus-visible:shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),0_0_0_3px_rgba(150,200,255,0.08)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
