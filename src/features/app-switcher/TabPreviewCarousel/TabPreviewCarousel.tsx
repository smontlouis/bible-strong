import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { TabItem } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useTabConstants from '../utils/useTabConstants'
import TabPreview from './TabPreview'

export interface TabPreviewCarouselProps {
  tabsAtoms: PrimitiveAtom<TabItem>[]
}

const TabPreviewCarousel = ({ tabsAtoms }: TabPreviewCarouselProps) => {
  const { activeTabPreview, tabPreviewCarousel } = useAppSwitcherContext()
  const { WIDTH, GAP } = useTabConstants()
  const styles = useAnimatedStyle(() => {
    return {
      opacity: tabPreviewCarousel.opacity.value,
      transform: [
        {
          scale: 1,
        },
        {
          translateX: -activeTabPreview.index.value * (WIDTH + GAP),
        },
        {
          translateY: tabPreviewCarousel.translateY.value,
        },
      ],
    }
  })

  return (
    <AnimatedBox
      row
      position="absolute"
      top={0}
      left={0}
      bg="lightGrey"
      style={styles}
    >
      {tabsAtoms.map((tabAtom, i) => (
        <TabPreview key={`${tabAtom}`} index={i} tabAtom={tabAtom} />
      ))}
    </AnimatedBox>
  )
}

export default TabPreviewCarousel
