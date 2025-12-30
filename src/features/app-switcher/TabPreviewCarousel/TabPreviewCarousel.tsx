import { useAtomValue } from 'jotai/react'
import React, { useDeferredValue } from 'react'
import { useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { tabsAtomsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useTabConstants from '../utils/useTabConstants'
import TabPreview from './TabPreview'

const TabPreviewCarousel = () => {
  const tabsAtoms = useAtomValue(tabsAtomsAtom)
  // Basse priorité : React peut différer ce render
  const deferredTabsAtoms = useDeferredValue(tabsAtoms)
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
    <AnimatedBox row position="absolute" top={0} left={0} bg="lightGrey" style={styles}>
      {deferredTabsAtoms.map((tabAtom, i) => (
        <TabPreview key={`${tabAtom}`} index={i} tabAtom={tabAtom} />
      ))}
    </AnimatedBox>
  )
}

export default TabPreviewCarousel
