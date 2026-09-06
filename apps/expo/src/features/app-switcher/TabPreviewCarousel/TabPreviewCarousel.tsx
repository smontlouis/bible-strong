import { useAtomValue } from 'jotai/react'
import React, { useDeferredValue } from 'react'
import { useAnimatedStyle } from 'react-native-reanimated'
import Box, { AnimatedBox } from '~common/ui/Box'
import { tabsAtomsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherContext'
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
      opacity: tabPreviewCarousel.opacity.get(),
      transform: [
        {
          scale: 1,
        },
        {
          translateX: -activeTabPreview.index.get() * (WIDTH + GAP),
        },
        {
          translateY: tabPreviewCarousel.translateY.get(),
        },
      ],
    }
  })

  return (
    <AnimatedBox
      className="border-continuous overflow-visible flex-row absolute top-[0px] left-[0px] bg-light-grey"
      style={styles}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Box
        className="overflow-hidden border-continuous absolute inset-[-300px] bg-light-grey"
        pointerEvents="none"
      />
      {deferredTabsAtoms.map((tabAtom, i) => (
        <TabPreview key={`${tabAtom}`} index={i} tabAtom={tabAtom} />
      ))}
    </AnimatedBox>
  )
}

export default TabPreviewCarousel
