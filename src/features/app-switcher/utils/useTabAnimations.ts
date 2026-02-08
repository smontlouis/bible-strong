import { useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { withDelay, withTiming } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import { activeTabIndexAtom, appSwitcherModeAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from './constants'
import { resolveAndSetTabId, fadeInTabScreen } from './tabHelpers'
import useTabConstants from './useTabConstants'
import useTakeActiveTabSnapshot from './useTakeActiveTabSnapshot'

export const useTabAnimations = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const setAppSwitcherMode = useSetAtom(appSwitcherModeAtom)
  const { HEIGHT } = useTabConstants()
  const takeActiveTabSnapshot = useTakeActiveTabSnapshot()

  const { activeTabPreview, activeTabScreen, tabPreviewCarousel } = useAppSwitcherContext()

  const setTabId = (index: number) => {
    resolveAndSetTabId(activeTabScreen.tabId, index)
  }

  const setActiveTabOpacity = () => {
    fadeInTabScreen(
      activeTabScreen.opacity,
      activeTabPreview.index,
      activeTabScreen.tabId,
      takeActiveTabSnapshot
    )
  }

  /**
   * Swipe path: fade in the tab screen FIRST (behind the carousel),
   * then hide the carousel only once the tab screen is fully opaque.
   * This prevents the grid from flashing through two semi-transparent layers.
   */
  const fadeInThenHideCarousel = () => {
    setTimeout(() => {
      activeTabScreen.opacity.set(
        withTiming(1, undefined, () => {
          // Tab screen fully visible — safe to hide carousel
          tabPreviewCarousel.opacity.set(0)
          tabPreviewCarousel.translateY.set(HEIGHT)
          activeTabPreview.zIndex.set(3)
          runOnJS(takeActiveTabSnapshot)(
            activeTabPreview.index.get(),
            activeTabScreen.tabId.get() || ''
          )
        })
      )
    }, 50)
  }

  /**
   * Collapse: full-screen tab -> preview thumbnail in grid.
   *
   * Entry points:
   *   - TabScreen back gesture / TabButton tap (in view mode)
   *
   * Sequence:
   *   1. Fade out the active TabScreen (opacity -> 0)
   *   2. Animate animationProgress 1 -> 0 (shrink to preview)
   *   3. On completion: set zIndex=2 (behind future expansions)
   *   4. Switch appSwitcherMode to 'list' -> bottom bar cross-fades
   *   5. Clear tabId (unmount cached screen content)
   */
  const minimizeTab = () => {
    'worklet'
    activeTabScreen.opacity.set(withTiming(0))
    activeTabPreview.animationProgress.set(
      withTiming(0, tabTimingConfig, () => {
        activeTabPreview.zIndex.set(2)
      })
    )
    runOnJS(setAppSwitcherMode)('list')
    activeTabScreen.tabId.set(null)
  }

  /**
   * Expand: preview thumbnail -> full-screen tab.
   *
   * Entry points:
   *   - useTabPreview.onOpen(): tap on a preview in the grid
   *   - useBottomTabBar.onPress(): tap OK in list mode
   *   - useExpandNewTab: after creating a new tab
   *
   * Sequence:
   *   1. appSwitcherMode = 'view' -> bottom bar cross-fades
   *   2. Position the overlay at measured coordinates (left, top)
   *   3. Animate animationProgress 0 -> 1 (scale to full screen)
   *   4. On completion: set Jotai activeTabIndex, resolve tabId, fade in TabScreen
   *   5. Take a screenshot for the future preview thumbnail
   */
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
        runOnJS(setTabId)(index)
        runOnJS(setActiveTabOpacity)()
      })
    )
  }

  /**
   * Common logic for completing a tab switch via the carousel.
   * Used by both slideToIndex (programmatic slide) and finishSwipe (gesture swipe).
   *
   * @param options.setTabIdImmediately - If true, sets tabId before animation (swipe).
   *   If false, sets tabId after animation completes (slide).
   * @param options.duration - Animation duration in ms (swipe=300, slide=400).
   * @param options.carouselFadeDelay - Delay before carousel fades out (swipe=150, slide=200).
   */
  const completeTabSwitch = (
    targetIndex: number,
    options?: { setTabIdImmediately?: boolean; duration?: number; carouselFadeDelay?: number }
  ) => {
    const { setTabIdImmediately = false, duration = 400, carouselFadeDelay = 200 } = options || {}

    setActiveTabIndex(targetIndex)
    if (setTabIdImmediately) {
      setTabId(targetIndex)
    }

    activeTabPreview.index.set(
      withTiming(targetIndex, { duration }, finished => {
        if (!finished) return

        if (setTabIdImmediately) {
          // Swipe path: fade in tab screen FIRST, then hide carousel.
          // The carousel stays at opacity=1 covering the grid while the
          // tab screen fades in behind it.
          runOnJS(fadeInThenHideCarousel)()
        } else {
          // Slide path: tab screen is already opaque, just fade carousel out.
          runOnJS(setTabId)(targetIndex)
          tabPreviewCarousel.opacity.set(
            withDelay(
              carouselFadeDelay,
              withTiming(0, undefined, finish => {
                if (!finish) {
                  tabPreviewCarousel.opacity.set(1)
                  return
                }
                tabPreviewCarousel.translateY.set(HEIGHT)
                activeTabPreview.zIndex.set(3)
                runOnJS(takeActiveTabSnapshot)(
                  activeTabPreview.index.get(),
                  activeTabScreen.tabId.get() || ''
                )
              })
            )
          )
        }
      })
    )
  }

  /**
   * Slide: switch to a different tab via the preview carousel (no expand/collapse).
   *
   * Entry points:
   *   - useSlideNewTab: after creating a tab in an already-expanded state
   *   - useOpenInNewTab: when opening content in a new tab
   *
   * Sequence:
   *   1. Show the preview carousel overlay
   *   2. Clear current tabId (hides active screen)
   *   3. Animate activeTabPreview.index to the target (carousel slides)
   *   4. On completion: resolve tabId, fade out carousel, take snapshot
   */
  const slideToIndex = (index: number) => {
    // Cas spécial: en mode 'view' avec le même index (ex: création d'onglet depuis état vide)
    if (activeTabPreview.index.get() === index) {
      const tabsCount = getDefaultStore().get(tabsCountAtom)
      const currentMode = getDefaultStore().get(appSwitcherModeAtom)

      // Si on est en mode 'view' et il y a des tabs, on doit quand même afficher l'écran
      if (currentMode === 'view' && tabsCount > 0) {
        runOnJS(setActiveTabIndex)(index)
        runOnJS(setTabId)(index)
        runOnJS(setActiveTabOpacity)()
      }
      return
    }

    tabPreviewCarousel.opacity.set(1)
    tabPreviewCarousel.translateY.set(0)
    activeTabScreen.tabId.set(null)

    completeTabSwitch(index, { duration: 400, carouselFadeDelay: 200 })
  }

  return { minimizeTab, expandTab, slideToIndex, completeTabSwitch }
}
