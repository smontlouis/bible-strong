import React from 'react'
import { Platform } from 'react-native'
import { FullWindowOverlay as FullWindowOverlayBase } from 'react-native-screens'

export const FullWindowOverlay = ({ children, ...props }: { children?: React.ReactNode }) => {
  return Platform.OS === 'ios' ? (
    <FullWindowOverlayBase {...props}>{children}</FullWindowOverlayBase>
  ) : (
    <>{children}</>
  )
}
