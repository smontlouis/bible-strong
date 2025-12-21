import { StackScreenProps } from '@react-navigation/stack'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import BibleNoteItem from './BibleNoteItem'
import BibleNoteModal from './BibleNoteModal'

import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import { Tag, VerseIds } from '~common/types'
import verseToReference from '~helpers/verseToReference'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { Note } from '~redux/modules/user'
import BibleNotesSettingsModal from './BibleNotesSettingsModal'

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
  const [noteSettingsId, setNoteSettingsId] = useState<string | null>(null)
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
          const verseNumbers: any = {}
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
    }, {} as any)

    setNoteVerses(noteVerses)
  }

  const closeTags = () => setIsTagsOpen(false)

  const renderNote = ({ item, index }: { item: TNote; index: number }) => {
    return (
      <BibleNoteItem
        key={index}
        item={item}
        onPress={openNoteEditor}
        onMenuPress={setNoteSettingsId}
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
      <BibleNoteModal noteVerses={noteVerses} />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={closeTags}
        onSelected={(chip: Tag) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      <BibleNotesSettingsModal noteId={noteSettingsId} />
    </Container>
  )
}

export default BibleVerseNotes
