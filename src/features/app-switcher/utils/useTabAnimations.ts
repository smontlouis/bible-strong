import { useSetAtom } from 'jotai/react'
import { withDelay, withTiming } from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  appSwitcherModeAtom,
  tabsAtomsAtom,
  tabsCountAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from './constants'
import useTabConstants from './useTabConstants'
import useTakeActiveTabSnapshot from './useTakeActiveTabSnapshot'
import { getDefaultStore } from 'jotai/vanilla'
import { runOnJS } from 'react-native-worklets'

export const useTabAnimations = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const setAppSwitcherMode = useSetAtom(appSwitcherModeAtom)
  const { HEIGHT } = useTabConstants()
  const takeActiveTabSnapshot = useTakeActiveTabSnapshot()

  const { activeTabPreview, activeTabScreen, tabPreviewCarousel } = useAppSwitcherContext()

  const setAtomId = (index: number) => {
    const atomId = getDefaultStore().get(tabsAtomsAtom)[index].toString()
    activeTabScreen.atomId.set(atomId)
  }

  const setActiveTabOpacity = () => {
    setTimeout(() => {
      activeTabScreen.opacity.set(
        withTiming(1, undefined, () => {
          runOnJS(takeActiveTabSnapshot)(
            activeTabPreview.index.get(),
            activeTabScreen.atomId.get() || ''
          )
        })
      )
    }, 50)
  }

  const minimizeTab = () => {
    'worklet'
    activeTabScreen.opacity.set(withTiming(0))
    activeTabPreview.animationProgress.set(
      withTiming(0, tabTimingConfig, () => {
        activeTabPreview.zIndex.set(2)
      })
    )
    runOnJS(setAppSwitcherMode)('list')
    activeTabScreen.atomId.set(null)
  }

  const expandTab = ({ index, left, top }: { index: number; left: number; top: number }) => {
    'worklet'

    runOnJS(setAppSwitcherMode)('view')
    activeTabPreview.zIndex.set(3)
    activeTabPreview.left.set(left)
    activeTabPreview.top.set(top)
    activeTabPreview.index.set(index)

    activeTabPreview.animationProgress.set(
      withTiming(1, tabTimingConfig, () => {
        runOnJS(setActiveTabIndex)(index)
        runOnJS(setAtomId)(index)
        runOnJS(setActiveTabOpacity)()
      })
    )
  }

  const slideToIndex = (index: number) => {
    // Cas spécial: en mode 'view' avec le même index (ex: création d'onglet depuis état vide)
    if (activeTabPreview.index.get() === index) {
      const tabsCount = getDefaultStore().get(tabsCountAtom)
      const currentMode = getDefaultStore().get(appSwitcherModeAtom)

      // Si on est en mode 'view' et il y a des tabs, on doit quand même afficher l'écran
      if (currentMode === 'view' && tabsCount > 0) {
        runOnJS(setActiveTabIndex)(index)
        runOnJS(setAtomId)(index)
        runOnJS(setActiveTabOpacity)()
      }
      return
    }

    tabPreviewCarousel.opacity.set(1)
    tabPreviewCarousel.translateY.set(0)
    activeTabScreen.atomId.set(null)
    runOnJS(setActiveTabIndex)(index)

    activeTabPreview.index.set(
      withTiming(index, { duration: 400 }, finished => {
        if (!finished) return

        runOnJS(setAtomId)(index)
        tabPreviewCarousel.opacity.set(
          withDelay(
            200,
            withTiming(0, undefined, finish => {
              if (!finish) {
                tabPreviewCarousel.opacity.set(1)
                return
              }
              tabPreviewCarousel.translateY.set(HEIGHT)
              activeTabPreview.zIndex.set(3)
              runOnJS(takeActiveTabSnapshot)(
                activeTabPreview.index.get(),
                activeTabScreen.atomId.get() || ''
              )
            })
          )
        )
      })
    )
  }

  return { minimizeTab, expandTab, slideToIndex }
}
