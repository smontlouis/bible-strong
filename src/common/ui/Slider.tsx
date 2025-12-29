import React, { createContext, useContext, useEffect, useRef } from 'react'
import {
  EntryAnimationsValues,
  EntryExitAnimationFunction,
  ExitAnimationsValues,
  SharedValue,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useSharedValue,
} from 'react-native-reanimated'
import { AnimatedBox, BoxProps } from '~common/ui/Box'
import { usePrevious } from '~helpers/usePrevious'

export type SliderContextProps = {
  isAnimationsEnabled: React.MutableRefObject<boolean>
  direction: SharedValue<'left' | 'right'>
  index: number
}

export const SliderContext = createContext<SliderContextProps | undefined>(undefined)

type SliderProviderProps = {
  children: React.ReactNode
  index: number
}

export const Slides = ({ children, index }: SliderProviderProps) => {
  const isAnimationsEnabled = useRef(false)
  const direction = useSharedValue<'left' | 'right'>('left')
  const prevIndex = usePrevious(index)

  // useEffect(() => {
  //   isAnimationsEnabled.current = true
  // }, [])

  useEffect(() => {
    if (prevIndex !== undefined && prevIndex !== index) {
      direction.set(prevIndex < index ? 'left' : 'right')
    }
  }, [index, prevIndex, direction])

  return (
    <SliderContext.Provider
      value={{
        isAnimationsEnabled,
        direction,
        index,
      }}
    >
      {React.Children.map(children, (child, i) => {
        if (!React.isValidElement<SlideProps>(child)) {
          return null
        }

        return React.cloneElement<SlideProps>(child, {
          slideIndex: i,
        })
      })}
    </SliderContext.Provider>
  )
}

export const useSlider = () => {
  const context = useContext(SliderContext)

  if (!context) {
    throw new Error('useSlider must be used within a SliderProvider')
  }

  return context
}

const slideOutLeftAnimation = new SlideOutLeft().build() as EntryExitAnimationFunction
const slideOutRightAnimation = new SlideOutRight().build() as EntryExitAnimationFunction

const slideInLeftAnimation = new SlideInLeft().build() as EntryExitAnimationFunction
const slideInRightAnimation = new SlideInRight().build() as EntryExitAnimationFunction

type SlideProps = {
  slideIndex?: number
}
export const Slide = ({ slideIndex, ...props }: BoxProps & SlideProps) => {
  const { direction, isAnimationsEnabled, index } = useSlider()

  const SlideIn = (values: EntryAnimationsValues & ExitAnimationsValues) => {
    'worklet'

    return direction.get() === 'left' ? slideInRightAnimation(values) : slideInLeftAnimation(values)
  }

  const SlideOut = (values: EntryAnimationsValues & ExitAnimationsValues) => {
    'worklet'

    return direction.get() === 'left'
      ? slideOutLeftAnimation(values)
      : slideOutRightAnimation(values)
  }

  //This is to check if the layouting took place and return the according animation
  const ifEnabled = (animation: any): any => {
    return isAnimationsEnabled.current ? animation : undefined
  }

  if (slideIndex !== index) {
    return null
  }

  return (
    <AnimatedBox entering={ifEnabled(SlideIn)} exiting={ifEnabled(SlideOut)} flex={1} {...props} />
  )
}
