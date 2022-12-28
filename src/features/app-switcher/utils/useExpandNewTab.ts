import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { usePrevious } from '~helpers/usePrevious'
import wait from '~helpers/wait'
import { appSwitcherModeAtom, tabsCountAtom } from '../../../state/tabs'
import useMeasureTabPreview from './useMesureTabPreview'
import { useTabAnimations } from './useTabAnimations'

const useExpandNewTab = () => {
  const tabsCount = useAtomValue(tabsCountAtom)
  const prevTabsCount = usePrevious(tabsCount)
  const { expandTab } = useTabAnimations()
  const measureTabPreview = useMeasureTabPreview()
  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  const { slideToIndex } = useTabAnimations()

  useEffect(() => {
    const isNewTab =
      tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'

    if (isNewTab) {
      ;(async () => {
        await wait(0)
        const index = tabsCount - 1

        if (appSwitcherMode === 'list') {
          const { pageX, pageY } = await measureTabPreview(index)
          expandTab({
            index,
            left: pageX,
            top: pageY,
          })
        }
        if (appSwitcherMode === 'view') {
          slideToIndex(index)
        }
      })()
    }
  }, [tabsCount, prevTabsCount, appSwitcherMode])
}

export default useExpandNewTab
