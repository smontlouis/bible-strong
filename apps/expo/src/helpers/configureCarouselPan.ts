import type { CarouselPanGesture } from 'react-native-reanimated-carousel'

export const configureCarouselPan =
  (activeOffsetX: [number, number]) => (gesture: CarouselPanGesture) => {
    gesture.activeOffsetX(activeOffsetX)
  }
