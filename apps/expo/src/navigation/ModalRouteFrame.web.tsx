import { router, useRootNavigationState } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'

import { hasModalBackgroundRoute } from './modalRoutePresentation'

const ModalRouteFrame = ({ children }: { children: ReactNode }) => {
  const rootState = useRootNavigationState()
  const { height, width } = useWindowDimensions()
  const isPresented = hasModalBackgroundRoute(rootState)

  useEffect(() => {
    if (!isPresented) return

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && router.canGoBack()) router.back()
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [isPresented])

  if (!isPresented) return children

  const compact = width < 720
  const dismiss = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <View style={styles.overlay}>
      <Pressable
        accessibilityLabel="Fermer la fenêtre"
        onPress={dismiss}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityViewIsModal
        role="dialog"
        style={[
          styles.dialog,
          {
            borderRadius: compact ? 0 : 20,
            height: compact ? height : Math.min(height - 48, 900),
            width: compact ? width : Math.min(width - 48, 1080),
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'center',
  },
  dialog: {
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.32)',
    maxHeight: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
})

export default ModalRouteFrame
