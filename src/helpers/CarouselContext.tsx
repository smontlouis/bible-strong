import React from 'react'

interface DictionnaireCarouselValue {
  current: string | null
  setCurrent: (value: string) => void
}

interface StrongCarouselValue {
  currentStrongReference: unknown
  goToCarouselItem: (index: number) => void
}

export type CarouselContextValue = DictionnaireCarouselValue | StrongCarouselValue

const CarouselContext = React.createContext<CarouselContextValue>({
  current: null,
  setCurrent: () => {},
})

export const CarouselProvider = CarouselContext.Provider
export const CarouselConsumer = CarouselContext.Consumer
