import * as FileSystem from 'expo-file-system'
import produce from 'immer'
import React, { useEffect } from 'react'
import { Appearance, EmitterSubscription, Platform } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import blackColors from '~themes/blackColors'
import defaultColors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'

import ImmersiveMode from 'react-native-immersive-mode'
import BibleViewer from './BibleViewer'
const deepmerge = require('@fastify/deepmerge')()

import { NavigationStackProp } from 'react-navigation-stack'

import { PrimitiveAtom } from 'jotai/vanilla'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { BibleTab } from '../../state/tabs'

interface BibleTabScreenProps {
  navigation: NavigationStackProp
  bibleAtom: PrimitiveAtom<BibleTab>
}

const BibleTabScreen = ({ navigation, bibleAtom }: BibleTabScreenProps) => {
  const [hasPaddingTop, setHasPaddingTop] = React.useState(false)
  const dispatch = useDispatch()

  const { settings, fontFamily } = useSelector(
    (state: RootState) => ({
      settings: produce(state.user.bible.settings, draftState => {
        // TODO: WHY IS THIS HERE?
        draftState.colors.default = deepmerge(
          defaultColors,
          draftState.colors.default || {}
        )
        draftState.colors.dark = deepmerge(
          darkColors,
          draftState.colors.dark || {}
        )
        draftState.colors.black = deepmerge(
          blackColors,
          draftState.colors.black || {}
        )
        draftState.colors.sepia = deepmerge(
          sepiaColors,
          draftState.colors.sepia || {}
        )
        draftState.colors.mauve = deepmerge(
          mauveColors,
          draftState.colors.mauve || {}
        )
        draftState.colors.nature = deepmerge(
          natureColors,
          draftState.colors.nature || {}
        )
        draftState.colors.night = deepmerge(
          nightColors,
          draftState.colors.night || {}
        )
        draftState.colors.sunset = deepmerge(
          sunsetColors,
          draftState.colors.sunset || {}
        )
        // TODO: END - WHY IS THIS HERE?

        const preferredColorScheme = draftState.preferredColorScheme || 'auto'
        const preferredDarkTheme = draftState.preferredDarkTheme || 'dark'
        const preferredLightTheme = draftState.preferredLightTheme || 'default'
        const systemColorScheme = Appearance.getColorScheme()

        // Provide derived theme as a settings now that we removed it from the redux store
        // @ts-ignore
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
      }),
      fontFamily: state.user.fontFamily,
    }),
    shallowEqual
  )

  const getIfMhyCommentsNeedsDownload = async () => {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const path = `${sqliteDirPath}/commentaires-mhy.sqlite`
    const file = await FileSystem.getInfoAsync(path)

    if (!file.exists) {
      return true
    }

    return false
  }

  useEffect(() => {
    let listen: EmitterSubscription
    ;(async () => {
      if (settings.commentsDisplay) {
        const mhyCommentsNeedsDownload = await getIfMhyCommentsNeedsDownload()
        if (mhyCommentsNeedsDownload) {
          console.log('Error with commentaires, deactivating...')
          dispatch(setSettingsCommentaires(false))
        }
      }
      if (Platform.OS === 'android') {
        listen = ImmersiveMode.addEventListener(e => {
          setHasPaddingTop(!e.statusBar)
        })
      }
    })()

    return () => {
      if (Platform.OS === 'android') {
        listen?.remove()
      }
    }
  }, [dispatch, settings.commentsDisplay])

  return (
    <BibleViewer
      navigation={navigation}
      settings={settings}
      fontFamily={fontFamily}
      bibleAtom={bibleAtom}
    />
  )
}

export default BibleTabScreen
