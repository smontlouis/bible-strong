import * as Sentry from '@sentry/react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Empty from '~common/Empty'
import QuickTagsModal from '~common/QuickTagsModal'
import Box, { MotiBox, motiTransition } from '~common/ui/Box'
import getBiblePericope from '~helpers/getBiblePericope'
import loadBibleChapter from '~helpers/loadBibleChapter'
import loadMhyComments from '~helpers/loadMhyComments'
import BibleHeader from './BibleHeader'

import { StackNavigationProp } from '@react-navigation/stack'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useDerivedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { BibleResource, Pericope, SelectedCode, Verse, VerseIds } from '~common/types'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
import AddToStudyModal from '~features/studies/AddToStudyModal'
import { useAddVerseToStudy } from '~features/studies/hooks/useAddVerseToStudy'
import VerseFormatBottomSheet from '~features/studies/VerseFormatBottomSheet'
import getVersesContent from '~helpers/getVersesContent'
import { useBottomSheet, useBottomSheetModal } from '~helpers/useBottomSheet'
import useLanguage from '~helpers/useLanguage'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { addHighlight, removeHighlight } from '~redux/modules/user'
import { makeHighlightsByChapterSelector, makeNotesByChapterSelector, makeIsSelectedVerseHighlightedSelector } from '~redux/selectors/bible'
import { historyAtom, isFullScreenBibleValue, multipleTagsModalAtom } from '../../state/app'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import { BibleDOMWrapper, ParallelVerse } from './BibleDOM/BibleDOMWrapper'
// import BibleWebView from './BibleDOMWebview'
import BibleNoteModal from './BibleNoteModal'
import BibleParamsModal from './BibleParamsModal'
import BibleFooter from './footer/BibleFooter'
import { OpenInNewTabButton } from './OpenInNewTabButton'
import ResourcesModal from './resources/ResourceModal'
import SelectedVersesModal from './SelectedVersesModal'
import StrongModal from './StrongModal'
import { LoadingView } from './LoadingView'

const getPericopeChapter = (pericope: Pericope | null, book: number, chapter: number) => {
  if (pericope && pericope[book] && pericope[book][chapter]) {
    return pericope[book][chapter]
  }

  return {}
}

interface BibleViewerProps {
  navigation: StackNavigationProp<MainStackProps>
  bibleAtom: PrimitiveAtom<BibleTab>
  commentsDisplay?: boolean
  settings: RootState['user']['bible']['settings']
  onMountTimeout?: () => void
  isBibleViewReloadingAtom: PrimitiveAtom<boolean>
}

const useBottomSheetDisclosure = <T,>() => {
  const [isOpen, setIsOpen] = useState<T | null>(null)
  const onOpen = setIsOpen
  const onClose = useRef(() => setIsOpen(null)).current
  const onToggle = useRef(() => setIsOpen(s => (s === null ? null : s))).current

  return { isOpen, onOpen, onClose, onToggle }
}

const formatVerses = (verses: string[]) =>
  verses.reduce((acc, v, i, array) => {
    // @ts-ignore
    if (v === array[i - 1] + 1 && v === array[i + 1] - 1) {
      // if suite > 2
      return acc
    }
    // @ts-ignore
    if (v === array[i - 1] + 1 && v !== array[i + 1] - 1) {
      // if endSuite
      return `${acc}-${v}`
    }
    // @ts-ignore
    if (array[i - 1] && v - 1 !== array[i - 1]) {
      // if not preceded by - 1
      return `${acc},${v}`
    }
    return acc + v
  }, '')

const BibleViewer = ({
  navigation,
  bibleAtom,
  settings,
  onMountTimeout,
  isBibleViewReloadingAtom,
}: BibleViewerProps) => {
  const { t } = useTranslation()

  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [verses, setVerses] = useState<Verse[]>([])
  const [parallelVerses, setParallelVerses] = useState<ParallelVerse[]>([])
  const [secondaryVerses, setSecondaryVerses] = useState<Verse[] | null>(null)
  const [comments, setComments] = useState<{ [key: string]: string } | null>(null)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const [noteVerses, setNoteVerses] = useState<VerseIds | undefined>(undefined)
  const strongModalDisclosure = useBottomSheetDisclosure<SelectedCode>()
  const [quickTagsModal, setQuickTagsModal] = useState<
    { ids: VerseIds; entity: string } | { id: string; entity: string } | false
  >(false)
  const bibleParamsModal = useBottomSheetModal()
  const resourceModal = useBottomSheet()

  // Add to study modal states
  const addToStudyModal = useBottomSheet()
  const verseFormatModal = useBottomSheet()
  const [pendingVerseData, setPendingVerseData] = useState<{
    studyId: string
    verseData: {
      title: string
      content: string
      version: string
      verses: string[]
    }
  } | null>(null)
  const addVerseToStudy = useAddVerseToStudy()

  const isFR = useLanguage()
  const dispatch = useDispatch()
  const pericope = useRef<Pericope | null>(null)
  const [resourceType, onChangeResourceType] = useState<BibleResource>('strong')
  const addHistory = useSetAtom(historyAtom)
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()

  const {
    data: {
      selectedVersion: version,
      selectedBook: book,
      selectedChapter: chapter,
      selectedVerse: verse,
      isReadOnly,
      isSelectionMode,
      focusVerses,
      parallelVersions,
      selectedVerses,
    },
  } = bible

  const selectAllVerses = () => {
    const selectedVersesToAdd: VerseIds = Object.fromEntries(
      verses.map(v => [`${v.Livre}-${v.Chapitre}-${v.Verset}`, true])
    )
    actions.selectAllVerses(selectedVersesToAdd)
  }

  const modalIsVisible = !!Object.keys(selectedVerses).length

  // Create memoized selectors
  const selectHighlightsByChapter = useMemo(() => makeHighlightsByChapterSelector(), [])
  const selectNotesByChapter = useMemo(() => makeNotesByChapterSelector(), [])
  const selectIsSelectedVerseHighlighted = useMemo(() => makeIsSelectedVerseHighlightedSelector(), [])

  const highlightedVersesByChapter = useSelector(
    (state: RootState) => selectHighlightsByChapter(state, book.Numero, chapter)
  )

  const notesByChapter = useSelector(
    (state: RootState) => selectNotesByChapter(state, book.Numero, chapter)
  )

  const isSelectedVerseHighlighted = useSelector(
    (state: RootState) => selectIsSelectedVerseHighlighted(state, selectedVerses)
  )

  useEffect(() => {
    // Settimeout ?
    loadVerses().catch(e => {
      console.log(e)
      setError(true)
      setIsLoading(false)
    })
    actions.clearSelectedVerses()
  }, [book, chapter, version, JSON.stringify(parallelVersions)])

  useEffect(() => {
    ;(async () => {
      if (settings.commentsDisplay && !comments) {
        const mhyComments = await loadMhyComments(book.Numero, chapter)
        try {
          setComments(JSON.parse(mhyComments.commentaires))
        } catch (e) {
          Sentry.withScope(scope => {
            scope.setExtra('Reference', `${book.Numero}-${chapter}`)
            scope.setExtra('Comments', mhyComments.commentaires)
            Sentry.captureException('Comments corrupted')
          })
        }
      }
    })()
  }, [])

  const loadVerses = async () => {
    pericope.current = await getBiblePericope(version)
    setIsLoading(true)

    const versesToLoad = await loadBibleChapter(book.Numero, chapter, version)
    const parallelVersesToLoad: ParallelVerse[] = []
    if (parallelVersions.length) {
      for (const p of parallelVersions) {
        const pVerses = (await loadBibleChapter(book.Numero, chapter, p)) as Verse[]
        parallelVersesToLoad.push({ id: p, verses: pVerses })
      }
    }

    let secondaryVersesToLoad: Verse[] | null = null
    if (version === 'INT' || version === 'INT_EN') {
      secondaryVersesToLoad = (await loadBibleChapter(
        book.Numero,
        chapter,
        isFR ? 'LSG' : 'KJV'
      )) as Verse[]
    }

    if (settings.commentsDisplay) {
      const commentsToLoad = await loadMhyComments(book.Numero, chapter)
      setComments(JSON.parse(commentsToLoad.commentaires))
    } else if (comments) {
      setComments(null)
    }

    if (!versesToLoad) {
      throw new Error('I crashed!')
    }

    setIsLoading(false)
    setVerses(versesToLoad)
    setParallelVerses(parallelVersesToLoad)
    setSecondaryVerses(secondaryVersesToLoad)
    setError(false)

    addHistory({
      book: book.Numero,
      chapter,
      verse,
      version,
      type: 'verse',
      date: Date.now(),
    })
    Sentry.addBreadcrumb({
      category: 'bible viewer',
      message: 'Load verses',
      data: { book: book.Numero, chapter, verse, version },
    })
  }

  const addHiglightAndOpenQuickTags = (color: string) => {
    setTimeout(() => {
      setQuickTagsModal({ ids: selectedVerses, entity: 'highlights' })
    }, 300)
    // @ts-ignore
    dispatch(addHighlight({ color, selectedVerses }))
    actions.clearSelectedVerses()
  }

  const addTag = () => {
    // @ts-ignore
    dispatch(addHighlight({ color: '', selectedVerses }))
    actions.clearSelectedVerses()

    setMultipleTagsItem({
      entity: 'highlights',
      ids: selectedVerses,
    })
  }

  const toggleCreateNote = () => {
    setNoteVerses(s => (s ? undefined : selectedVerses))
  }

  const closeNoteModal = () => {
    setNoteVerses(undefined)
  }

  const openNoteModal = (noteId: string) => {
    try {
      const noteVersesToLoad = noteId.split('/').reduce((accuRefs, key) => {
        accuRefs[key] = true
        return accuRefs
      }, {} as VerseIds)
      setNoteVerses(noteVersesToLoad)
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setExtra('Error', e instanceof Error ? e.toString() : String(e))
        scope.setExtra('Note', noteId)
        Sentry.captureMessage('Note corrumpted')
      })
    }
  }

  const onChangeResourceTypeSelectVerse = (res: BibleResource, ver: string) => {
    actions.selectSelectedVerse(ver)
    onChangeResourceType(res)
    resourceModal.open()
  }

  // Add to study handlers
  const handleOpenAddToStudy = () => {
    addToStudyModal.open()
  }

  const handleSelectStudy = useCallback(
    async (studyId: string) => {
      // Capture verse data immediately when study is selected
      const { title, content } = await getVersesContent({
        verses: selectedVerses,
        version,
      })

      const verseData = {
        title,
        content,
        version,
        verses: Object.keys(selectedVerses),
      }

      setPendingVerseData({ studyId, verseData })
      verseFormatModal.open()
    },
    [selectedVerses, version, verseFormatModal]
  )

  const handleSelectFormat = useCallback(
    (format: 'inline' | 'block') => {
      if (!pendingVerseData) return

      addVerseToStudy(pendingVerseData.studyId, pendingVerseData.verseData, format)

      // Close both modals and reset state
      verseFormatModal.close()
      addToStudyModal.close()
      setPendingVerseData(null)
      actions.clearSelectedVerses()
    },
    [pendingVerseData, addVerseToStudy, verseFormatModal, addToStudyModal, actions]
  )

  const handleCloseFormatBottomSheet = useCallback(() => {
    setPendingVerseData(null)
  }, [])

  const handleCloseAddToStudyModal = useCallback(() => {
    setPendingVerseData(null)
  }, [])

  // Déplacer le hook en dehors de la condition de rendu
  const translationY = useDerivedValue(() => {
    return {
      translateY: isFullScreenBibleValue.value ? HEADER_HEIGHT + insets.bottom + 20 : 0,
    }
  })

  console.log('BibleViewer', version, book.Numero, chapter, verse)

  return (
    <Box flex={1} bg="reverse">
      <BibleHeader
        navigation={navigation}
        bibleAtom={bibleAtom}
        onBibleParamsClick={bibleParamsModal.open}
        commentsDisplay={settings.commentsDisplay}
        verseFormatted={
          // @ts-ignore
          focusVerses ? formatVerses(focusVerses) : verse.toString()
        }
        isParallel={parallelVersions.length > 0}
        version={version}
        bookName={book.Nom}
        chapter={chapter}
        hasBackButton={isReadOnly || Boolean(isSelectionMode)}
      />
      {error && (
        <Box flex={1} zIndex={-1}>
          <Empty
            source={require('~assets/images/empty.json')}
            message={
              "Désolé ! Une erreur est survenue:\n Ce chapitre n'existe pas dans cette version.\n Si vous êtes en mode parallèle, désactivez la version concernée."
            }
          />
        </Box>
      )}
      {!error && verses.length > 0 && (
        <BibleDOMWrapper
          bibleAtom={bibleAtom}
          isBibleViewReloadingAtom={isBibleViewReloadingAtom}
          book={book}
          chapter={chapter}
          isLoading={isLoading}
          navigation={navigation}
          addSelectedVerse={actions.addSelectedVerse}
          removeSelectedVerse={actions.removeSelectedVerse}
          setSelectedVerse={actions.setSelectedVerse}
          version={version}
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          verses={verses}
          parallelVerses={parallelVerses}
          focusVerses={focusVerses}
          secondaryVerses={secondaryVerses}
          selectedVerses={selectedVerses}
          highlightedVerses={highlightedVersesByChapter}
          notedVerses={notesByChapter}
          settings={settings}
          verseToScroll={verse}
          pericopeChapter={getPericopeChapter(pericope.current, book.Numero, chapter)}
          openNoteModal={openNoteModal}
          setSelectedCode={strongModalDisclosure.onOpen}
          selectedCode={strongModalDisclosure.isOpen}
          comments={comments}
          removeParallelVersion={actions.removeParallelVersion}
          addParallelVersion={actions.addParallelVersion}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          setMultipleTagsItem={setMultipleTagsItem}
          onChangeResourceTypeSelectVerse={onChangeResourceTypeSelectVerse}
          onMountTimeout={onMountTimeout}
        />
      )}
      {!isReadOnly && (
        <BibleFooter
          bibleAtom={bibleAtom}
          disabled={isLoading}
          book={book}
          chapter={chapter}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          goToChapter={actions.goToChapter}
          version={version}
        />
      )}
      {isReadOnly && !error && (
        <MotiBox
          center
          paddingBottom={insets.bottom}
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          // @ts-ignore
          animate={translationY}
          {...motiTransition}
        >
          <OpenInNewTabButton book={book} chapter={chapter} verse={verse} version={version} />
        </MotiBox>
      )}
      <SelectedVersesModal
        isVisible={modalIsVisible}
        isSelectionMode={isSelectionMode}
        isSelectedVerseHighlighted={isSelectedVerseHighlighted}
        onChangeResourceType={val => {
          onChangeResourceType(val)
          resourceModal.open()
        }}
        onCreateNoteClick={toggleCreateNote}
        addHighlight={addHiglightAndOpenQuickTags}
        addTag={addTag}
        removeHighlight={() => {
          // @ts-ignore
          dispatch(removeHighlight({ selectedVerses }))
          actions.clearSelectedVerses()
        }}
        clearSelectedVerses={actions.clearSelectedVerses}
        selectedVerses={selectedVerses}
        selectAllVerses={selectAllVerses}
        version={version}
        onAddToStudy={handleOpenAddToStudy}
      />
      <QuickTagsModal
        item={quickTagsModal}
        onClosed={() => setQuickTagsModal(false)}
        setMultipleTagsItem={setMultipleTagsItem}
      />
      <BibleNoteModal onClosed={closeNoteModal} noteVerses={noteVerses} />
      <StrongModal
        version={version}
        selectedCode={strongModalDisclosure.isOpen}
        onClosed={strongModalDisclosure.onClose}
      />

      <ResourcesModal
        resourceModalRef={resourceModal.ref}
        bibleAtom={bibleAtom}
        resourceType={resourceType}
        onChangeResourceType={onChangeResourceType}
        isSelectionMode={isSelectionMode}
      />
      <BibleParamsModal navigation={navigation} modalRef={bibleParamsModal.ref} />
      <AddToStudyModal
        bottomSheetRef={addToStudyModal.ref}
        onSelectStudy={handleSelectStudy}
        onClose={handleCloseAddToStudyModal}
      />
      <VerseFormatBottomSheet
        bottomSheetRef={verseFormatModal.ref}
        onSelectFormat={handleSelectFormat}
        onClose={handleCloseFormatBottomSheet}
      />
      <LoadingView isBibleViewReloadingAtom={isBibleViewReloadingAtom} />
    </Box>
  )
}

export default BibleViewer
