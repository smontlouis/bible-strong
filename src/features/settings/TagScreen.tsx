import React from 'react'
import styled from '@emotion/native'
import { useSelector, useDispatch } from 'react-redux'
import distanceInWords from 'date-fns/formatDistance'
import { fr, enGB } from 'date-fns/locale'

import TitlePrompt from '~common/TitlePrompt'
import { addTag, updateTag, removeTag } from '~redux/modules/user'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
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
import LexiqueResultItem from '~features/lexique/LexiqueResultItem'
import NaveResultItem from '~features/nave/NaveResultItem'
import DictionnaryResultItem from '~features/dictionnary/DictionnaryResultItem'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const NoteItem = ({ item, t, isFR }) => {
  const [Livre, Chapitre, Verset] = item.id.split('-')
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: isFR ? fr : enGB,
  })

  return (
    <Link
      route="BibleView"
      params={{
        isReadOnly: true,
        book: books[Livre - 1],
        chapter: Number(Chapitre),
        verse: Number(Verset),
      }}
    >
      <Box padding={20}>
        <Box row justifyContent="space-between">
          <Text color="darkGrey" bold fontSize={11}>
            {title} - {t('Il y a {{formattedDate}}', { formattedDate })}
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
  const { t } = useTranslation()
  const isFR = useLanguage()

  const {
    highlights,
    notes,
    studies,
    tag,
    naves,
    words,
    strongsGrec,
    strongsHebreu,
  } = useSelector(state => ({
    highlights: item.highlights
      ? sortVersesByDate(
          Object.keys(item.highlights).reduce(
            (arr, id) => ({ ...arr, [id]: state.user.bible.highlights[id] }),
            {}
          )
        )
      : [],
    notes: item.notes
      ? Object.keys(item.notes)
          .map(id => ({ id, reference: '', ...state.user.bible.notes[id] }))
          .filter(c => c)
      : [],
    studies: item.studies
      ? Object.keys(item.studies)
          .map(id => state.user.bible.studies[id])
          .filter(c => c)
      : [],
    naves: item.naves
      ? Object.keys(item.naves)
          .map(id => state.user.bible.naves[id])
          .filter(c => c)
      : [],
    words: item.words
      ? Object.keys(item.words)
          .map(id => state.user.bible.words[id])
          .filter(c => c)
      : [],
    strongsHebreu: item.strongsHebreu
      ? Object.keys(item.strongsHebreu)
          .map(id => state.user.bible.strongsHebreu[id])
          .filter(c => c)
      : [],
    strongsGrec: item.strongsGrec
      ? Object.keys(item.strongsGrec)
          .map(id => state.user.bible.strongsGrec[id])
          .filter(c => c)
      : [],
    tag: state.user.bible.tags[item.id],
  }))
  const [titlePrompt, setTitlePrompt] = React.useState(false)

  return (
    <Container>
      <Header
        hasBackButton
        title={tag.name}
        rightComponent={
          <Link
            onPress={() => setTitlePrompt({ id: tag.id, name: tag.name })}
            padding
          >
            <FeatherIcon size={20} name="edit-3" />
          </Link>
        }
      />
      <ScrollView>
        {!highlights.length &&
          !notes.length &&
          !studies.length &&
          !naves.length &&
          !words.length &&
          !strongsGrec.length &&
          !strongsHebreu.length && (
            <Empty
              source={require('~assets/images/empty.json')}
              message={t("Vous n'avez rien enregistré avec cette étiquette...")}
            />
          )}
        {(!!strongsGrec.length || !!strongsHebreu.length) && (
          <Box>
            <Text padding={20} fontSize={20} title>
              Strongs
            </Text>
            <Box row wrap px={20}>
              {strongsGrec.map(s => {
                return (
                  <LexiqueResultItem
                    key={s.id + s.title}
                    id={s.id}
                    title={s.title}
                    variant="grec"
                  />
                )
              })}
              {strongsHebreu.map(s => {
                return (
                  <LexiqueResultItem
                    key={s.id + s.title}
                    id={s.id}
                    title={s.title}
                    variant="hebreu"
                  />
                )
              })}
            </Box>
          </Box>
        )}
        {!!naves.length && (
          <Box>
            <Text padding={20} fontSize={20} title>
              {t('Thèmes nave')}
            </Text>
            <Box row wrap px={20}>
              {naves.map(s => {
                return (
                  <NaveResultItem
                    key={s.id}
                    name_lower={s.id}
                    name={s.title}
                    variant="grec"
                  />
                )
              })}
            </Box>
          </Box>
        )}
        {!!words.length && (
          <Box>
            <Text padding={20} fontSize={20} title>
              {t('Dictionnaire')}
            </Text>
            <Box row wrap px={20}>
              {words.map(s => {
                return <DictionnaryResultItem key={s.id} word={s.title} />
              })}
            </Box>
          </Box>
        )}
        {!!highlights.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              {t('Surbrillances')}
            </Text>

            {highlights.map(h => {
              const { color, date, verseIds, tags } = h
              return (
                <HighlightItem
                  key={date}
                  {...{ color, date, verseIds, tags }}
                />
              )
            })}
          </Box>
        )}

        {!!notes.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              Notes
            </Text>
            {notes.map(n => {
              return (
                <NoteItem t={t} isFR={isFR} key={n.date.toString()} item={n} />
              )
            })}
          </Box>
        )}

        {!!studies.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              {t('Études')}
            </Text>
            <Box row>
              {studies.map(item => {
                return <StudyItem key={item.id} study={item} />
              })}
            </Box>
          </Box>
        )}
      </ScrollView>
      <TitlePrompt
        placeholder={t("Nom de l'étiquette")}
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
