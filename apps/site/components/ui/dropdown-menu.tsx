import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as React from 'react'
import { cn } from '@/src/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Label ref={ref} className={cn('px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground', className)} {...props} />,
)
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName
const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Item ref={ref} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent', className)} {...props} />,
)
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName
const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  ({ className, sideOffset = 4, ...props }, ref) => <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 max-h-96 min-w-40 overflow-auto rounded-md border bg-background p-1 shadow-md', className)} {...props} /></DropdownMenuPrimitive.Portal>,
)
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

export { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger }
