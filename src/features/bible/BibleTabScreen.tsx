import { useTheme } from '@emotion/react'
import * as FileSystem from 'expo-file-system'
import produce from 'immer'
import React, { useEffect } from 'react'
import { Appearance, EmitterSubscription, Platform } from 'react-native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import { useDispatch, useSelector } from 'react-redux'

import ImmersiveMode from 'react-native-immersive-mode'
import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import BibleHeader from './BibleHeader'
import BibleParamsModal from './BibleParamsModal'
import BibleViewer from './BibleViewer'

import { NavigationStackProp } from 'react-navigation-stack'

import { PrimitiveAtom } from 'jotai'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { BibleTab, useBibleTabActions } from '../../state/tabs'

interface BibleTabScreenProps {
  navigation: NavigationStackProp
  bibleAtom: PrimitiveAtom<BibleTab>
}

const BibleTabScreen = ({ navigation, bibleAtom }: BibleTabScreenProps) => {
  const [isBibleParamsOpen, setIsBibleParamsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasPaddingTop, setHasPaddingTop] = React.useState(false)
  const theme = useTheme()
  const dispatch = useDispatch()

  const { settings, fontFamily } = useSelector((state: RootState) => ({
    settings: produce(state.user.bible.settings, draftState => {
      draftState.colors.default = {
        ...theme.colors,
        ...draftState.colors.default,
      }
      draftState.colors.dark = {
        ...theme.colors,
        ...draftState.colors.dark,
      }
      draftState.colors.black = {
        ...theme.colors,
        ...draftState.colors.black,
      }
      draftState.colors.sepia = {
        ...theme.colors,
        ...draftState.colors.sepia,
      }

      const preferredColorScheme = draftState.preferredColorScheme
      const preferredDarkTheme = draftState.preferredDarkTheme
      const preferredLightTheme = draftState.preferredLightTheme
      const systemColorScheme = Appearance.getColorScheme()

      // Provide derived theme as a settings now that we removed it from the redux store
      // @ts-ignore
      draftState.theme = (() => {
        if (preferredColorScheme === 'auto') {
          if (systemColorScheme === 'dark') {
            return preferredDarkTheme
          }
          return preferredLightTheme
        }

        if (preferredColorScheme === 'dark') return preferredDarkTheme
        return preferredLightTheme
      })()
    }),
    fontFamily: state.user.fontFamily,
  }))

  const getIfMhyCommentsNeedsDownload = async () => {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const path = `${sqliteDirPath}/commentaires-mhy.sqlite`
    const file = await FileSystem.getInfoAsync(path)

    if (!file.exists) {
      return true
    }

    return false
  }
  const toggleBibleParamsOpen = () => setIsBibleParamsOpen(s => !s)
  const closeBibleParamsOpen = () => setIsBibleParamsOpen(false)

  useEffect(() => {
    let listen: EmitterSubscription
    ;(async () => {
      if (settings.commentsDisplay) {
        const mhyCommentsNeedsDownload = await getIfMhyCommentsNeedsDownload()
        if (mhyCommentsNeedsDownload) {
          console.log('Error with commentaires, deactivating...')
          dispatch(setSettingsCommentaires(false))
        }
        setIsLoading(false)
      } else {
        setIsLoading(false)
      }

      if (Platform.OS === 'android') {
        listen = ImmersiveMode.addEventListener(e => {
          setHasPaddingTop(!e.statusBar)
        })
      }
    })()

    return () => {
      if (Platform.OS === 'android') {
        listen.remove()
      }
    }
  }, [dispatch, settings.commentsDisplay])

  return (
    <Container
      pure
      style={{
        paddingTop: hasPaddingTop ? 0 : getStatusBarHeight(),
      }}
    >
      <BibleHeader
        navigation={navigation}
        bibleAtom={bibleAtom}
        onBibleParamsClick={toggleBibleParamsOpen}
        setSettingsCommentaires={v => dispatch(setSettingsCommentaires(v))}
        commentsDisplay={settings.commentsDisplay}
      />
      <BibleViewer
        navigation={navigation}
        settings={settings}
        fontFamily={fontFamily}
        bibleAtom={bibleAtom}
      />
      <BibleParamsModal
        navigation={navigation}
        onClosed={closeBibleParamsOpen}
        isOpen={isBibleParamsOpen}
      />
    </Container>
  )
}

export default BibleTabScreen
