import { produce } from 'immer'
import { useEffect, useMemo, useState } from 'react'

import { Book } from '~assets/bible_versions/books-desc'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'

import { useLocalSearchParams, useRouter } from 'expo-router'
import { atom } from 'jotai/vanilla'
import {
  BibleContextDisplayMode,
  BibleTab,
  getDefaultBibleTab,
  VersionCode,
} from '../../state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import BibleTabScreen from './BibleTabScreen'
import { IS_FORM_SHEET } from '~helpers/constants'
import {
  BibleVerseResolutionStatus,
  getBibleLocationVerseKeys,
  resolveBibleVerses,
} from '~helpers/bibleVerseResolver'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import verseToReference from '~helpers/verseToReference'
import { useTranslation } from 'react-i18next'

type BibleScreenContentProps = {
  focusVerses?: number[]
  isSelectionMode?: string
  contextDisplayMode?: BibleContextDisplayMode
  book?: Book | number
  chapter?: number
  verse?: number
  version: string
}

const BibleScreenContent = ({
  focusVerses,
  isSelectionMode,
  contextDisplayMode,
  book,
  chapter,
  verse,
  version,
}: BibleScreenContentProps) => {
  const initialValues = produce(getDefaultBibleTab(version as VersionCode), draft => {
    draft.id = `bible-${generateUUID()}`
    if (book)
      draft.data.selectedBook = Number.isInteger(book)
        ? getBook(book as number) || getBook(1)!
        : (book as Book)

    if (chapter) draft.data.selectedChapter = chapter
    if (verse) draft.data.selectedVerse = verse
    if (focusVerses) draft.data.focusVerses = focusVerses
    if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode as StudyNavigateBibleType
    if (contextDisplayMode) {
      draft.data.contextDisplayMode = contextDisplayMode
    }
  })

  // Always create an on-the-fly atom for this screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bibleAtom = useMemo(() => atom<BibleTab>(initialValues), [])

  return <BibleTabScreen bibleAtom={bibleAtom} isFormSheet={IS_FORM_SHEET} isInTab={false} />
}

const BibleReferenceUnavailable = ({ verseKeys }: { verseKeys: string[] }) => {
  const router = useRouter()
  const { t } = useTranslation()
  const reference = verseToReference(verseKeys)

  return (
    <Box flex>
      <Empty
        source={require('~assets/images/empty.json')}
        message={`${reference}\n${t('bibleVerse.textUnavailableInstalled')}`}
      >
        <Box mt={20}>
          <Button onPress={() => router.push('/downloads')}>
            {t('bible.error.goToDownloads')}
          </Button>
        </Box>
      </Empty>
    </Box>
  )
}

const BibleScreen = () => {
  const params = useLocalSearchParams<{
    focusVerses?: string
    contextDisplayMode?: BibleContextDisplayMode
    isSelectionMode?: string
    isReadOnly?: string
    book?: string
    chapter?: string
    verse?: string
    version?: string
  }>()

  // Parse params from URL strings
  const focusVerses = params.focusVerses ? JSON.parse(params.focusVerses) : undefined
  const isSelectionMode = params.isSelectionMode || undefined
  const contextDisplayMode =
    params.contextDisplayMode || (params.isReadOnly === 'true' ? 'focused' : undefined)
  const book = params.book ? JSON.parse(params.book) : undefined
  const chapter = params.chapter ? Number(params.chapter) : undefined
  const verse = params.verse ? Number(params.verse) : undefined
  const defaultVersion = useDefaultBibleVersion()
  const requestedVersion = params.version || undefined
  const bookNumber = typeof book === 'number' ? book : book?.Numero
  const [resolvedVersion, setResolvedVersion] = useState(requestedVersion || defaultVersion)
  const [resolutionStatus, setResolutionStatus] = useState<BibleVerseResolutionStatus>('resolved')
  const [isResolvingVersion, setIsResolvingVersion] = useState(Boolean(bookNumber && chapter))
  const requestedVerseKeys = getBibleLocationVerseKeys({
    book: bookNumber,
    chapter,
    verse,
    focusVerses,
  })
  const requestedVerseKeysSignature = requestedVerseKeys.join('|')

  useEffect(() => {
    let cancelled = false

    if (!bookNumber || !chapter) {
      setResolvedVersion(requestedVersion || defaultVersion)
      setResolutionStatus('resolved')
      setIsResolvingVersion(false)
      return
    }

    setIsResolvingVersion(true)
    resolveBibleVerses({
      verseKeys: requestedVerseKeysSignature.split('|'),
      preferredVersion: requestedVersion,
      defaultVersion,
    })
      .then(resolution => {
        if (!cancelled) {
          setResolvedVersion(resolution.version || requestedVersion || defaultVersion)
          setResolutionStatus(resolution.status)
        }
      })
      .catch(error => {
        console.error('[BibleScreen] Failed to resolve a compatible Bible version:', error)
        if (!cancelled) setResolutionStatus('reference-only')
      })
      .finally(() => {
        if (!cancelled) setIsResolvingVersion(false)
      })

    return () => {
      cancelled = true
    }
  }, [bookNumber, chapter, requestedVerseKeysSignature, requestedVersion, defaultVersion])

  if (isResolvingVersion) return null
  if (resolutionStatus !== 'resolved') {
    return <BibleReferenceUnavailable verseKeys={requestedVerseKeys} />
  }

  return (
    <BibleScreenContent
      focusVerses={focusVerses}
      isSelectionMode={isSelectionMode}
      contextDisplayMode={contextDisplayMode}
      book={book}
      chapter={chapter}
      verse={verse}
      version={resolvedVersion}
    />
  )
}

export default BibleScreen
