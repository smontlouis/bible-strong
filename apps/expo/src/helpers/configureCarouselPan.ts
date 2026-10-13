import type { LegacyPanGesture } from 'react-native-gesture-handler'

// react-native-reanimated-carousel 5 beta types its pan gesture as gesture-handler's `PanGesture`.
// Since gesture-handler 3 that name is the hook-based gesture, while the carousel still hands over
// the builder gesture, exported as `LegacyPanGesture`.
export const configureCarouselPan = (activeOffsetX: [number, number]) => (gesture: unknown) => {
  ;(gesture as LegacyPanGesture).activeOffsetX(activeOffsetX)
}
