import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { soundManager } from "@/utils/soundEffects"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-none bg-pixel-navy p-1 text-pixel-lavender border-3 border-pixel-gray font-retro text-lg",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, onClick, ...props }, ref) => {
  const handleClick = (e) => {
    soundManager.playSwitch()
    if (onClick) onClick(e)
  }

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-none px-4 py-1.5 font-pixel text-[9px] uppercase tracking-wider ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pixel-blue disabled:pointer-events-none disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 data-[state=active]:bg-pixel-blue data-[state=active]:text-pixel-navy data-[state=active]:shadow-pixel-sm transition-transform cursor-pointer",
        className
      )}
      {...props} />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pixel-blue animate-pixel-pop",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
