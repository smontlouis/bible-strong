// @flow
import styled from '@emotion/native'
import * as Sentry from '@sentry/react-native'
import React, { useEffect, useRef, useState } from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { useDispatch, useSelector } from 'react-redux'
import BibleHeader from './BibleHeader'
import Empty from '~common/Empty'
import QuickTagsModal from '~common/QuickTagsModal'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import getBiblePericope from '~helpers/getBiblePericope'
import loadBibleChapter from '~helpers/loadBibleChapter'
import loadMhyComments from '~helpers/loadMhyComments'
import { audioDefault, audioV2 } from '~helpers/topBibleAudio'
import { zeroFill } from '~helpers/zeroFill'

import { PrimitiveAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { NavigationStackProp } from 'react-navigation-stack'
import { shallowEqual } from 'recompose'
import { Verse } from '~common/types'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import NaveModal from '~features/nave/NaveModal'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import {
  addHighlight,
  removeHighlight,
  setHistory,
  setSettingsCommentaires,
} from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import {
  BibleTab,
  getDefaultBibleTab,
  useBibleTabActions,
  VersionCode,
} from '../../state/tabs'
import BibleFooter from './BibleFooter'
import BibleNoteModal from './BibleNoteModal'
import BibleWebView from './BibleWebView'
import ReferenceModal from './ReferenceModal'
import SelectedVersesModal from './SelectedVersesModal'
import StrongModal from './StrongModal'
import BibleParamsModal from './BibleParamsModal'
import BibleVerseDetailModal from './BibleVerseDetailModal'
import DictionnaireVerseDetailModal from '~features/dictionnary/DictionnaireVerseDetailModal'
import CommentariesModal from '~features/commentaries/CommentariesModal'

const Container = styled.View({
  flex: 1,
  overflow: 'hidden',
})

const ReadMeButton = styled(Button)({
  marginTop: 5,
  marginBottom: 10 + getBottomSpace(),
  width: 250,
})

const getPericopeChapter = (pericope, book, chapter) => {
  if (pericope[book] && pericope[book][chapter] && pericope[book][chapter]) {
    return pericope[book][chapter]
  }

  return {}
}

interface BibleViewerProps {
  navigation: NavigationStackProp
  bibleAtom: PrimitiveAtom<BibleTab>
  commentsDisplay?: boolean
  settings: RootState['user']['bible']['settings']
  fontFamily: string
}

const useBottomSheetDisclosure = <T,>() => {
  const [isOpen, setIsOpen] = useState<T | null>(null)
  const onOpen = setIsOpen
  const onClose = () => setIsOpen(null)
  const onToggle = () => setIsOpen(s => !s)

  return { isOpen, onOpen, onClose, onToggle }
}

const BibleViewer = ({
  navigation,
  bibleAtom,
  settings,
  fontFamily,
}: BibleViewerProps) => {
  const { t } = useTranslation()

  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [verses, setVerses] = useState<Verse[]>([])
  const [parallelVerses, setParallelVerses] = useState<
    { id: VersionCode; verses: any }[] | null
  >(null)
  const [secondaryVerses, setSecondaryVerses] = useState(null)
  const [comments, setComments] = useState(null)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const [quickTagsModal, setQuickTagsModal] = useState<
    | { ids: { [verse: string]: true }; entity: string }
    | { id: string; entity: string }
    | false
  >(false)
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false)
  const [noteVerses, setNoteVerses] = useState<{
    [verse: string]: true
  } | null>(null)
  const [audioChapterUrl, setAudioChapterUrl] = useState('')
  const [audioMode, setAudioMode] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const strongModalDisclosure = useBottomSheetDisclosure<{
    reference: string
    book: number
  }>()
  const naveModalDisclosure = useBottomSheetDisclosure<string>()
  const referenceModalDisclosure = useBottomSheetDisclosure<string>()
  const verseDetailModalDisclosure = useBottomSheetDisclosure<Verse>()
  const dictionaryDetailModalDisclosure = useBottomSheetDisclosure<Verse>()
  const commentariesModalDisclosure = useBottomSheetDisclosure<string>()
  const bibleParamsModalDisclosure = useBottomSheetDisclosure<boolean>()

  const isFR = useLanguage()
  const dispatch = useDispatch()
  const openInNewTab = useOpenInNewTab()
  const pericope = useRef(getBiblePericope(isFR ? 'LSG' : 'KJV'))

  const [bible, actions] = useBibleTabActions(bibleAtom)

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
    const selectedVersesToAdd: { [verse: string]: true } = Object.fromEntries(
      verses.map(v => [`${v.Livre}-${v.Chapitre}-${v.Verset}`, true])
    )
    actions.selectAllVerses(selectedVersesToAdd)
  }

  const modalIsVisible = !!Object.keys(selectedVerses).length

  const highlightedVersesByChapter = useSelector((state: RootState) => {
    const highlightedVerses = state.user.bible.highlights
    const bookAndChapter = `${book.Numero}-${chapter}-`

    let object: typeof highlightedVerses = {}
    for (const key in highlightedVerses) {
      if (key.startsWith(bookAndChapter)) {
        object[key] = highlightedVerses[key]
      }
    }
    return object
  }, shallowEqual)

  const notesByChapter = useSelector((state: RootState) => {
    const notes = state.user.bible.notes
    const bookAndChapter = `${book.Numero}-${chapter}-`

    let object: typeof notes = {}
    for (const key in notes) {
      if (key.startsWith(bookAndChapter)) {
        object[key] = notes[key]
      }
    }
    return object
  }, shallowEqual)

  const isSelectedVerseHighlighted = useSelector((state: RootState) =>
    Object.keys(selectedVerses).find(s => state.user.bible.highlights[s])
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
        setComments(JSON.parse(mhyComments.commentaires))
      }
    })()
  }, [])

  const loadVerses = async () => {
    pericope.current = getBiblePericope(version)
    setIsLoading(true)

    const versesToLoad = await loadBibleChapter(book.Numero, chapter, version)
    const parallelVersesToLoad = []
    if (parallelVersions.length) {
      for (const p of parallelVersions) {
        const pVerses = await loadBibleChapter(book.Numero, chapter, p)
        parallelVersesToLoad.push({ id: p, verses: pVerses })
      }
    }

    let secondaryVersesToLoad = null
    if (version === 'INT') {
      secondaryVersesToLoad = await loadBibleChapter(
        book.Numero,
        chapter,
        isFR ? 'LSG' : 'KJV'
      )
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

    const audioBaseUrl = (() => {
      if (audioV2.includes(book.Numero.toString())) {
        return 'https://s.topchretien.com/media/topbible/bible_v2/'
      }

      if (audioDefault.includes(book.Numero.toString())) {
        return 'https://s.topchretien.com/media/topbible/bible/'
      }

      return 'https://s.topchretien.com/media/topbible/bible_say/'
    })()

    setIsLoading(false)
    setVerses(versesToLoad)
    setParallelVerses(parallelVersesToLoad)
    setSecondaryVerses(secondaryVersesToLoad)
    setError(false)
    setAudioChapterUrl(
      `${audioBaseUrl}${zeroFill(book.Numero, 2)}_${zeroFill(chapter, 2)}.mp3`
    )

    dispatch(
      setHistory({
        book: book.Numero,
        chapter,
        verse,
        version,
        type: 'verse',
      })
    )
    Sentry.addBreadcrumb({
      category: 'bible viewer',
      message: 'Load verses',
      data: { book: book.Numero, chapter, verse, version },
    })
  }

  const openInBibleTab = () => {
    openInNewTab({
      id: `bible-${Date.now()}`,
      title: t('tabs.new'),
      isRemovable: true,
      type: 'bible',
      data: {
        ...getDefaultBibleTab().data,
        selectedBook: book,
        selectedChapter: chapter,
        selectedVerse: verse,
        selectedVersion: version,
      },
    })
  }

  const addHiglightAndOpenQuickTags = (color: string) => {
    setTimeout(() => {
      setQuickTagsModal({ ids: selectedVerses, entity: 'highlights' })
    }, 300)

    dispatch(addHighlight({ color, selectedVerses }))
    actions.clearSelectedVerses()
  }

  const addTag = () => {
    dispatch(addHighlight({ color: '', selectedVerses }))
    actions.clearSelectedVerses()

    setMultipleTagsItem({
      entity: 'highlights',
      ids: selectedVerses,
    })
  }

  const toggleCreateNote = () => {
    setIsCreateNoteOpen(s => !s)
    setNoteVerses(null)
  }

  const openNoteModal = (noteId: string) => {
    try {
      const noteVersesToLoad = noteId.split('/').reduce((accuRefs, key) => {
        accuRefs[key] = true
        return accuRefs
      }, {} as { [verse: string]: true })
      setIsCreateNoteOpen(s => !s)
      setNoteVerses(noteVersesToLoad)
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setExtra('Error', e.toString())
        scope.setExtra('Note', noteId)
        Sentry.captureMessage('Note corrumpted')
      })
    }
  }

  const onSaveNote = (id: string) => {
    setTimeout(() => {
      setQuickTagsModal({ id, entity: 'notes' })
    }, 300)
  }

  // TODO: At some point, send to WebView ONLY chapter based elements (notes, highlighted...)
  return (
    <Container>
      <BibleHeader
        navigation={navigation}
        bibleAtom={bibleAtom}
        onBibleParamsClick={bibleParamsModalDisclosure.onToggle}
        setSettingsCommentaires={v => dispatch(setSettingsCommentaires(v))}
        commentsDisplay={settings.commentsDisplay}
      />
      {error && (
        <Empty
          source={require('~assets/images/empty.json')}
          message={
            "Désolé ! Une erreur est survenue:\n Ce chapitre n'existe pas dans cette version.\n Si vous êtes en mode parallème, désactivez la version concernée."
          }
        />
      )}
      {!error && (
        <BibleWebView
          bibleAtom={bibleAtom}
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
          fontFamily={fontFamily}
          verseToScroll={verse}
          pericopeChapter={getPericopeChapter(
            pericope.current,
            book.Numero,
            chapter
          )}
          openNoteModal={openNoteModal}
          setSelectedCode={strongModalDisclosure.onOpen}
          setStrongVerseDetail={verseDetailModalDisclosure.onOpen}
          selectedCode={strongModalDisclosure.isOpen}
          comments={comments}
          removeParallelVersion={actions.removeParallelVersion}
          addParallelVersion={actions.addParallelVersion}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          setMultipleTagsItem={setMultipleTagsItem}
        />
      )}
      {!isReadOnly && (
        <BibleFooter
          disabled={isLoading}
          book={book}
          chapter={chapter}
          goToPrevChapter={actions.goToPrevChapter}
          goToNextChapter={actions.goToNextChapter}
          audioUrl={audioChapterUrl}
          version={version}
          audioMode={audioMode}
          isPlaying={isPlaying}
          setAudioMode={setAudioMode}
          setIsPlaying={setIsPlaying}
        />
      )}
      {isReadOnly && !error && (
        <Box center background>
          <ReadMeButton onPress={openInBibleTab}>
            {t('tab.openInNewTab')}
          </ReadMeButton>
        </Box>
      )}
      <SelectedVersesModal
        settings={settings}
        isSelectionMode={isSelectionMode}
        setSelectedVerse={actions.setSelectedVerse}
        setReference={referenceModalDisclosure.onOpen}
        setNave={naveModalDisclosure.onOpen}
        setStrongVerseDetail={verseDetailModalDisclosure.onOpen}
        setDictionaryVerseDetail={dictionaryDetailModalDisclosure.onOpen}
        setCommentaries={commentariesModalDisclosure.onOpen}
        onCreateNoteClick={toggleCreateNote}
        isVisible={modalIsVisible}
        isSelectedVerseHighlighted={isSelectedVerseHighlighted}
        addHighlight={addHiglightAndOpenQuickTags}
        addTag={addTag}
        removeHighlight={() => {
          dispatch(removeHighlight({ selectedVerses }))
          actions.clearSelectedVerses()
        }}
        clearSelectedVerses={actions.clearSelectedVerses}
        navigation={navigation}
        selectedVerses={selectedVerses}
        selectAllVerses={selectAllVerses}
        version={version}
      />
      <QuickTagsModal
        item={quickTagsModal}
        onClosed={() => setQuickTagsModal(false)}
        setMultipleTagsItem={setMultipleTagsItem}
      />
      {isCreateNoteOpen && (
        <BibleNoteModal
          onClosed={toggleCreateNote}
          isOpen={isCreateNoteOpen}
          noteVerses={noteVerses}
          selectedVerses={selectedVerses}
          onSaveNote={onSaveNote}
        />
      )}
      <StrongModal
        version={version}
        selectedCode={strongModalDisclosure.isOpen}
        onClosed={strongModalDisclosure.onClose}
      />
      <ReferenceModal
        version={version}
        selectedVerse={referenceModalDisclosure.isOpen}
        onClosed={referenceModalDisclosure.onClose}
      />
      <NaveModal
        selectedVerse={naveModalDisclosure.isOpen}
        onClosed={naveModalDisclosure.onClose}
      />
      <BibleVerseDetailModal
        verse={verseDetailModalDisclosure.isOpen}
        onChangeVerse={verseDetailModalDisclosure.onOpen}
        onClose={verseDetailModalDisclosure.onClose}
      />
      <DictionnaireVerseDetailModal
        verse={dictionaryDetailModalDisclosure.isOpen}
        onChangeVerse={dictionaryDetailModalDisclosure.onOpen}
        onClose={dictionaryDetailModalDisclosure.onClose}
      />
      <CommentariesModal
        verse={commentariesModalDisclosure.isOpen}
        onChangeVerse={commentariesModalDisclosure.onOpen}
        onClose={commentariesModalDisclosure.onClose}
      />
      <BibleParamsModal
        navigation={navigation}
        onClosed={bibleParamsModalDisclosure.onClose}
        isOpen={bibleParamsModalDisclosure.isOpen}
      />
    </Container>
  )
}

export default BibleViewer
