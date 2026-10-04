import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import {cn} from "@/lib/utils"

function Tabs({className, ...props}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function TabsList({
                    className,
                    ...props
                  }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-auto items-center justify-center rounded-lg bg-white/[0.04] p-1 text-slate-400 ring-1 ring-white/10",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
                       className,
                       ...props
                     }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all hover:text-slate-200 [&_svg]:shrink-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
                       className,
                       ...props
                     }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

export {Tabs, TabsList, TabsTrigger, TabsContent}