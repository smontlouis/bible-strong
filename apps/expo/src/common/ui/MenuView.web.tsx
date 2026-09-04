import React, { forwardRef, useImperativeHandle } from 'react'
import type { MenuAction, MenuComponentProps, MenuComponentRef } from '@expo/ui/community/menu'

export type { MenuAction, MenuComponentProps, MenuComponentRef }

export const MenuView = forwardRef<MenuComponentRef, MenuComponentProps>(({ children }, ref) => {
  useImperativeHandle(ref, () => ({ show: () => undefined }))

  return <>{children}</>
})

MenuView.displayName = 'MenuView'
