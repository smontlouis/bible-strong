import React from 'react'

interface DictionnaireCarouselValue {
  current: string | null
  setCurrent: (value: string) => void
}

export type CarouselContextValue = DictionnaireCarouselValue

const CarouselContext = React.createContext<CarouselContextValue>({
  current: null,
  setCurrent: () => {},
})

export const CarouselProvider = CarouselContext.Provider
export const CarouselConsumer = CarouselContext.Consumer
