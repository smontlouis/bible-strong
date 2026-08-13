import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../../lib/utils'

const fieldVariants = cva('group/field flex w-full gap-3', {
  variants: {
    orientation: {
      vertical: 'flex-col [&>*]:w-full',
      horizontal: 'flex-row items-center',
      responsive: 'flex-col @md:flex-row @md:items-center',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn('flex w-full flex-col gap-7', className)}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      className={cn('flex items-center gap-2 text-sm font-medium leading-snug', className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-sm font-normal leading-normal text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Field, FieldDescription, FieldGroup, FieldTitle }
