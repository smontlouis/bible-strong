import * as FileSystem from 'expo-file-system'
import produce from 'immer'
import React, { useEffect, useMemo, useState } from 'react'
import { Appearance } from 'react-native'
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
const deepmerge = require('@fastify/deepmerge')()

import { StackNavigationProp } from '@react-navigation/stack'

import { atom, getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { getDatabases } from '~helpers/databases'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { BibleTab } from '../../state/tabs'

interface BibleTabScreenProps {
  navigation: StackNavigationProp<MainStackProps, 'BibleView'>
  bibleAtom: PrimitiveAtom<BibleTab> // extract to MainStackNaviagtor as props
}

const BibleTabScreen = ({ navigation, bibleAtom }: BibleTabScreenProps) => {
  const dispatch = useDispatch()
  const [reloadKey, setReloadKey] = useState(0)
  const isBibleViewReloadingAtom = useMemo(() => atom(false), [])

  const rawSettings = useSelector((state: RootState) => state.user.bible.settings)
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)

  const settings = useMemo(() => {
    return produce(rawSettings, draftState => {
      // TODO: WHY IS THIS HERE?
      draftState.colors.default = deepmerge(defaultColors, draftState.colors.default || {})
      draftState.colors.dark = deepmerge(darkColors, draftState.colors.dark || {})
      draftState.colors.black = deepmerge(blackColors, draftState.colors.black || {})
      draftState.colors.sepia = deepmerge(sepiaColors, draftState.colors.sepia || {})
      draftState.colors.mauve = deepmerge(mauveColors, draftState.colors.mauve || {})
      draftState.colors.nature = deepmerge(natureColors, draftState.colors.nature || {})
      draftState.colors.night = deepmerge(nightColors, draftState.colors.night || {})
      draftState.colors.sunset = deepmerge(sunsetColors, draftState.colors.sunset || {})
      // TODO: END - WHY IS THIS HERE?

      const preferredColorScheme = draftState.preferredColorScheme || 'auto'
      const preferredDarkTheme = draftState.preferredDarkTheme || 'dark'
      const preferredLightTheme = draftState.preferredLightTheme || 'default'
      const systemColorScheme = Appearance.getColorScheme()

      // Provide derived theme as a settings now that we removed it from the redux store
      draftState.theme =
        (() => {
          if (preferredColorScheme === 'auto') {
            if (systemColorScheme === 'dark') {
              return preferredDarkTheme
            }
            return preferredLightTheme
          }

          if (preferredColorScheme === 'dark') return preferredDarkTheme
          return preferredLightTheme
        })() || 'default'

      draftState.fontFamily = fontFamily
    })
  }, [rawSettings, fontFamily])

  const getIfMhyCommentsNeedsDownload = async () => {
    const path = getDatabases().MHY.path
    const file = await FileSystem.getInfoAsync(path)

    if (!file.exists) {
      return true
    }

    return false
  }

  useEffect(() => {
    ;(async () => {
      if (settings.commentsDisplay) {
        const mhyCommentsNeedsDownload = await getIfMhyCommentsNeedsDownload()
        if (mhyCommentsNeedsDownload) {
          console.log('Error with commentaires, deactivating...')
          dispatch(setSettingsCommentaires(false))
        }
      }
    })()
  }, [dispatch, settings.commentsDisplay])

  const handleBibleViewerReload = () => {
    console.log('Bible component failed to mount, forcing reload')
    setReloadKey(prev => prev + 1)
    getDefaultStore().set(isBibleViewReloadingAtom, true)
  }

  return (
    <BibleViewer
      key={`bible-viewer-${reloadKey}`}
      navigation={navigation}
      settings={settings}
      bibleAtom={bibleAtom}
      onMountTimeout={handleBibleViewerReload}
      isBibleViewReloadingAtom={isBibleViewReloadingAtom}
    />
  )
}

export default BibleTabScreen
