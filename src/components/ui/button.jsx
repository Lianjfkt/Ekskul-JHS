import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "pixel-btn inline-flex items-center justify-center whitespace-nowrap text-xs font-pixel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 rounded-none",
  {
    variants: {
      variant: {
        default: "bg-pixel-blue text-pixel-navy border-pixel-gray hover:brightness-110",
        destructive: "bg-pixel-red text-pixel-white border-pixel-gray hover:brightness-110",
        outline: "border-pixel-gray bg-pixel-panel text-pixel-peach hover:bg-pixel-panel-light",
        secondary: "bg-pixel-purple text-pixel-white border-pixel-gray hover:brightness-110",
        ghost: "bg-transparent text-pixel-peach border-transparent shadow-none hover:bg-pixel-panel [box-shadow:none]",
        link: "text-pixel-blue underline-offset-4 hover:underline border-transparent shadow-none [box-shadow:none]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-[10px]",
        lg: "h-12 px-8 text-xs",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
