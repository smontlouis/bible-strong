import React from 'react'
import styled from '@emotion/native'
import { useSelector, useDispatch } from 'react-redux'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'

import * as Icon from '@expo/vector-icons'

import TitlePrompt from '~common/TitlePrompt'
import { addTag, updateTag, removeTag } from '~redux/modules/user'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Container from '~common/ui/Container'
import { sortVersesByDate } from '~features/settings/VersesList'
import HighlightItem from '~features/settings/Verse'
import formatVerseContent from '~helpers/formatVerseContent'

import Link from '~common/Link'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Border from '~common/ui/Border'
import truncate from '~helpers/truncate'
import TagList from '~common/TagList'
import StudyItem from '~features/studies/StudyItem'
import books from '~assets/bible_versions/books-desc'

const NoteItem = ({ item }) => {
  const [Livre, Chapitre, Verset] = item.id.split('-')
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), Date.now(), { locale: frLocale })

  return (
    <Link
      route="BibleView"
      params={{
        isReadOnly: true,
        book: books[Livre - 1],
        chapter: Number(Chapitre),
        verse: Number(Verset)
      }}>
      <Box padding={20}>
        <Box row justifyContent="space-between">
          <Text color="darkGrey" bold fontSize={11}>
            {title} - Il y a {formattedDate}
          </Text>
        </Box>
        {!!item.title && (
          <Text title fontSize={16} scale={-2}>
            {item.title}
          </Text>
        )}
        {!!item.description && (
          <Paragraph scale={-3} scaleLineHeight={-1}>
            {truncate(item.description, 100)}
          </Paragraph>
        )}
        <TagList tags={item.tags} />
      </Box>
      <Border />
    </Link>
  )
}

const TagScreen = ({ navigation }) => {
  const { item } = navigation.state.params
  const dispatch = useDispatch()

  const { highlights, notes, studies, tag } = useSelector(state => ({
    highlights: item.highlights
      ? sortVersesByDate(
          Object.keys(item.highlights).reduce(
            (arr, id) => ({ ...arr, [id]: state.user.bible.highlights[id] }),
            {}
          )
        )
      : [],
    notes: item.notes
      ? Object.keys(item.notes).map(id => ({ id, reference: '', ...state.user.bible.notes[id] }))
      : [],
    studies: item.studies ? Object.keys(item.studies).map(id => state.user.bible.studies[id]) : [],
    tag: state.user.bible.tags[item.id]
  }))
  const [titlePrompt, setTitlePrompt] = React.useState(false)

  return (
    <Container>
      <Header
        hasBackButton
        title={tag.name}
        rightComponent={
          <Link onPress={() => setTitlePrompt({ id: tag.id, name: tag.name })} padding>
            <Icon.Feather size={20} name="edit-3" />
          </Link>
        }
      />
      <ScrollView>
        {!highlights.length && !notes.length && !studies.length && (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Vous n'avez rien enregistré avec cette étiquette..."
          />
        )}
        {!!highlights.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              Surbrillances
            </Text>

            {highlights.map(h => {
              const { color, date, verseIds, tags } = h
              return <HighlightItem key={date} {...{ color, date, verseIds, tags }} />
            })}
          </Box>
        )}

        {!!notes.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              Notes
            </Text>
            {notes.map(n => {
              return <NoteItem key={n.date.toString()} item={n} />
            })}
          </Box>
        )}

        {!!studies.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              Études
            </Text>
            {studies.map(item => {
              return <StudyItem key={item.id} study={item} />
            })}
          </Box>
        )}
      </ScrollView>
      <TitlePrompt
        isOpen={!!titlePrompt}
        title={titlePrompt.name}
        onClosed={() => setTitlePrompt(false)}
        onSave={value => {
          dispatch(updateTag(titlePrompt.id, value))
        }}
      />
    </Container>
  )
}

export default TagScreen
