import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import type * as React from 'react'

import { cn } from '../../lib/utils'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'group/switch inline-flex h-5 w-8 shrink-0 items-center rounded-full border border-transparent bg-input outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0 rounded-full bg-background shadow-sm transition-transform group-data-[checked]/switch:translate-x-3" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
