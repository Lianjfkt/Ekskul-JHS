import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "pixel-badge inline-flex items-center rounded-none border-2 px-2 py-1 font-pixel text-[8px] uppercase tracking-wider",
  {
    variants: {
      variant: {
        default:
          "border-pixel-blue bg-pixel-blue/20 text-pixel-blue",
        secondary:
          "border-pixel-lavender bg-pixel-panel text-pixel-lavender",
        destructive:
          "border-pixel-red bg-pixel-red/20 text-pixel-red",
        outline: "border-pixel-gray text-pixel-peach bg-transparent",
        success:
          "border-pixel-green bg-pixel-green/20 text-pixel-green",
        warning:
          "border-pixel-orange bg-pixel-orange/20 text-pixel-orange",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
