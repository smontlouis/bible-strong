import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { usePrevious } from '~helpers/usePrevious'
import wait from '~helpers/wait'
import { tabsCountAtom } from '../../../state/tabs'
import useMeasureTabPreview from './useMesureTabPreview'
import { useTabAnimations } from './worklets'

const useNewTab = () => {
  const tabsCount = useAtomValue(tabsCountAtom)
  const prevTabsCount = usePrevious(tabsCount)
  const { expandTab } = useTabAnimations()
  const measureTabPreview = useMeasureTabPreview()

  useEffect(() => {
    const isNewTab =
      tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'

    if (isNewTab) {
      ;(async () => {
        await wait(0)
        const index = tabsCount - 1
        const { pageX, pageY } = await measureTabPreview(index)
        expandTab({
          index,
          left: pageX,
          top: pageY,
        })
      })()
    }
  }, [tabsCount, prevTabsCount])
}

export default useNewTab
