import React, { useState, useEffect } from 'react'
import { Alert } from 'react-native'
import { connect, useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StackScreenProps } from '@react-navigation/stack'

import BibleNoteModal from './BibleNoteModal'
import BibleNoteItem from './BibleNoteItem'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Empty from '~common/Empty'
import MultipleTagsModal from '~common/MultipleTagsModal'

import * as UserActions from '~redux/modules/user'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'
import verseToReference from '~helpers/verseToReference'
import { MainStackProps } from '~navigation/type'
import { Tag, VerseIds } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'

type TNote = {
  noteId: string
  reference: string
  notes: Note
}

const BibleVerseNotes = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'BibleVerseNotes'>) => {
  const { withBack, verse } = route.params || {}
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState<TNote[]>([])
  const [noteVerses, setNoteVerses] = useState<VerseIds | undefined>(undefined)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [selectedChip, setSelectedChip] = useState<Tag | undefined>(undefined)
  const [isNoteSettingsOpen, setIsNoteSettingsOpen] = useState<VerseIds | null>(
    null
  )
  const dispatch = useDispatch()
  const _notes = useSelector((state: RootState) => state.user.bible.notes)

  useEffect(() => {
    loadPage()
  }, [verse, _notes])

  const loadPage = async () => {
    const { verse } = route.params || {}
    let title
    const filtered_notes: TNote[] = []

    if (verse) {
      title = verseToReference(verse)
      title = `${t('Notes sur')} ${title}...`
    } else {
      title = 'Notes'
    }

    await Promise.all(
      Object.entries(_notes)
        .filter(note => {
          if (verse) {
            const firstVerseRef = note[0].split('/')[0]
            return firstVerseRef === verse
          }
          return true
        })
        .map(note => {
          const verseNumbers = {}
          note[0].split('/').map(ref => {
            verseNumbers[ref] = true
          })

          const reference = verseToReference(verseNumbers)
          filtered_notes.push({ noteId: note[0], reference, notes: note[1] })
        })
    )

    setTitle(title)
    setNotes(filtered_notes)
  }

  const openNoteEditor = (noteId: string) => {
    const noteVerses = noteId.split('/').reduce((accuRefs, key) => {
      accuRefs[key] = true
      return accuRefs
    }, {})

    setNoteVerses(noteVerses)
  }

  const closeNoteEditor = () => {
    setNoteVerses(undefined)
  }

  const closeTags = () => setIsTagsOpen(false)
  const closeNoteSettings = () => setIsNoteSettingsOpen(null)

  const deleteNote = (noteId: string) => {
    Alert.alert(
      t('Attention'),
      t('Voulez-vous vraiment supprimer cette note?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => dispatch(deleteNote(noteId)),
          style: 'destructive',
        },
      ]
    )
  }

  const renderNote = ({ item, index }: { item: TNote; index: number }) => {
    return (
      <BibleNoteItem
        key={index}
        item={item}
        setNoteSettings={setIsNoteSettingsOpen}
        navigation={navigation}
      />
    )
  }

  const filteredNotes = notes.filter(s =>
    selectedChip ? s.notes.tags && s.notes.tags[selectedChip.id] : true
  )

  return (
    <Container>
      {verse ? (
        <Header hasBackButton={withBack} title={title || t('Chargement...')} />
      ) : (
        <TagsHeader
          title="Notes"
          setIsOpen={setIsTagsOpen}
          isOpen={isTagsOpen}
          selectedChip={selectedChip}
          hasBackButton
        />
      )}
      {filteredNotes.length ? (
        <FlatList
          data={filteredNotes}
          renderItem={renderNote}
          keyExtractor={(item: TNote, index: number) => index.toString()}
          style={{ paddingBottom: 30 }}
        />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore de notes...")}
        />
      )}
      <BibleNoteModal onClosed={closeNoteEditor} noteVerses={noteVerses} />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={closeTags}
        onSelected={(chip: Tag) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <BibleNotesSettingsModal
        isOpen={isNoteSettingsOpen}
        onClosed={closeNoteSettings}
        openNoteEditor={openNoteEditor}
      />
    </Container>
  )
}

export default BibleVerseNotes
