import { createElement, type Ref } from 'react'
import type { SheetProps, SheetRef } from '~common/sheet'

/** Reuse a sheet's form and footer inside a panel screen, without another overlay. */
export default function InlineSheetContent({
  children,
  footer,
}: SheetProps & { ref?: Ref<SheetRef> }) {
  return (
    <>
      {children}
      {footer ? createElement(footer, {}) : null}
    </>
  )
}
