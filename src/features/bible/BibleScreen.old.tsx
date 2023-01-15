import { useTheme } from '@emotion/react'
import * as FileSystem from 'expo-file-system'
import produce from 'immer'
import React, { useEffect } from 'react'
import { Appearance, EmitterSubscription, Platform } from 'react-native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import ImmersiveMode from 'react-native-immersive-mode'
import books, { Book } from '~assets/bible_versions/books-desc'
import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import BibleHeader from './BibleHeader'
import BibleParamsModal from './BibleParamsModal'
import BibleViewer from './BibleViewer'

import { NavigationStackScreenProps } from 'react-navigation-stack'
import {
  addParallelVersion,
  removeAllParallelVersions,
} from '~redux/modules/bible.old'
import { RootState } from '~redux/modules/reducer'
import { setSettingsCommentaires } from '~redux/modules/user'
import { VersionCode } from '../../state/tabs'

interface BibleTabScreenProps {
  focusVerses?: string[]
  isSelectionMode?: boolean
  isReadOnly?: boolean
  book: Book | number
  chapter: number
  verse: number
  version: VersionCode
}

const BibleTabScreen = ({
  navigation,
}: NavigationStackScreenProps<BibleTabScreenProps>) => {
  const [isBibleParamsOpen, setIsBibleParamsOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasPaddingTop, setHasPaddingTop] = React.useState(false)
  const theme = useTheme()
  const dispatch = useDispatch()

  const {
    focusVerses,
    isSelectionMode,
    isReadOnly,
    book,
    chapter,
    verse,
    version,
  } = navigation.state.params || {}

  const { app, settings, fontFamily } = useSelector(
    (state: RootState) => ({
      app: {
        book: book || state.bible.selectedBook,
        chapter: chapter || state.bible.selectedChapter,
        verse: verse || state.bible.selectedVerse,
        version: version || state.bible.selectedVersion,
        parallelVersions:
          isSelectionMode || isReadOnly ? [] : state.bible.parallelVersions,
      },
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

  if (isLoading) {
    return <Loading />
  }

  if (Number.isInteger(app.book)) {
    app.book = books[(app.book as number) - 1]
  }

  return (
    <Container
      pure
      style={{
        paddingTop: hasPaddingTop ? 0 : getStatusBarHeight(),
      }}
    >
      <BibleHeader
        navigation={navigation}
        isReadOnly={isReadOnly}
        isSelectionMode={isSelectionMode}
        book={app.book}
        chapter={app.chapter}
        verse={app.verse}
        focusVerses={focusVerses}
        version={app.version}
        onBibleParamsClick={toggleBibleParamsOpen}
        isParallel={!!app.parallelVersions.length}
        addParallelVersion={v => dispatch(addParallelVersion(v))}
        removeAllParallelVersions={v => dispatch(removeAllParallelVersions(v))}
        setSettingsCommentaires={v => dispatch(setSettingsCommentaires(v))}
        settings={settings}
      />
      <BibleViewer
        isReadOnly={isReadOnly}
        isSelectionMode={isSelectionMode}
        focusVerses={focusVerses}
        book={app.book}
        chapter={app.chapter}
        verse={app.verse}
        version={app.version}
        parallelVersions={app.parallelVersions}
        navigation={navigation}
        settings={settings}
        fontFamily={fontFamily}
        setSettingsCommentaires={setSettingsCommentaires}
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
