import { produce } from 'immer'
import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'

import BibleViewer from './BibleViewer'

import { atom, getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { getIfLocalResourceNeedsDownload } from '~features/resources/resourceAvailability'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { BibleTab } from '../../state/tabs'
import { LocalUnifiedTagsModalProvider } from '~common/UnifiedTagsModalProvider'
import { BookSelectorSheetProvider } from './BookSelectorSheet/BookSelectorSheetProvider'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const deepmerge = require('@fastify/deepmerge')()

interface BibleTabScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  isFormSheet?: boolean
}

const BibleTabScreen = ({ bibleAtom, isFormSheet }: BibleTabScreenProps) => {
  const dispatch = useDispatch()
  const [reloadKey, setReloadKey] = useState(0)
  const isBibleViewReloadingAtom = useMemo(() => atom(false), [])

  const rawSettings = useSelector((state: RootState) => state.user.bible.settings)
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: currentTheme } = useCurrentThemeSelector()

  const settings = useMemo(
    () =>
      produce(rawSettings, draftState => {
        draftState.colors.default = deepmerge(defaultColors, draftState.colors.default || {})
        draftState.colors.dark = deepmerge(darkColors, draftState.colors.dark || {})
        draftState.colors.black = deepmerge(blackColors, draftState.colors.black || {})
        draftState.colors.sepia = deepmerge(sepiaColors, draftState.colors.sepia || {})
        draftState.colors.mauve = deepmerge(mauveColors, draftState.colors.mauve || {})
        draftState.colors.nature = deepmerge(natureColors, draftState.colors.nature || {})
        draftState.colors.night = deepmerge(nightColors, draftState.colors.night || {})
        draftState.colors.sunset = deepmerge(sunsetColors, draftState.colors.sunset || {})

        draftState.theme = currentTheme
        draftState.fontFamily = fontFamily
      }),
    [rawSettings, fontFamily, currentTheme]
  )

  const getIfMhyCommentsNeedsDownload = async () => {
    return getIfLocalResourceNeedsDownload({ kind: 'database', databaseId: 'MHY' })
  }

  useEffect(() => {
    ;(async () => {
      if (settings.commentsDisplay) {
        const mhyCommentsNeedsDownload = await getIfMhyCommentsNeedsDownload()
        if (mhyCommentsNeedsDownload) {
          console.log('[Bible] Error with commentaires, deactivating...')
          dispatch(setSettingsCommentaires(false))
        }
      }
    })()
  }, [dispatch, settings.commentsDisplay])

  const handleBibleViewerReload = () => {
    console.log('[Bible] Bible component failed to mount, forcing reload')
    setReloadKey(prev => prev + 1)
    getDefaultStore().set(isBibleViewReloadingAtom, true)
  }

  const content = (
    <BibleViewer
      key={`bible-viewer-${reloadKey}`}
      settings={settings}
      bibleAtom={bibleAtom}
      onMountTimeout={handleBibleViewerReload}
      isBibleViewReloadingAtom={isBibleViewReloadingAtom}
      isFormSheet={isFormSheet}
    />
  )

  if (isFormSheet) {
    return (
      <BookSelectorSheetProvider>
        <LocalUnifiedTagsModalProvider>{content}</LocalUnifiedTagsModalProvider>
      </BookSelectorSheetProvider>
    )
  }

  return content
}

export default BibleTabScreen
