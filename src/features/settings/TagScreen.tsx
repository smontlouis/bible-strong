import distanceInWords from 'date-fns/formatDistance'
import enGB from 'date-fns/locale/en-GB'
import fr from 'date-fns/locale/fr'
import React from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import TitlePrompt from '~common/TitlePrompt'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import HighlightItem from '~features/settings/Verse'
import formatVerseContent from '~helpers/formatVerseContent'
import { updateTag } from '~redux/modules/user'

import { useTranslation } from 'react-i18next'
import books from '~assets/bible_versions/books-desc'
import Empty from '~common/Empty'
import Link from '~common/Link'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import DictionnaryResultItem from '~features/dictionnary/DictionaryResultItem'
import LexiqueResultItem from '~features/lexique/LexiqueResultItem'
import NaveResultItem from '~features/nave/NaveResultItem'
import StudyItem from '~features/studies/StudyItem'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import { StackScreenProps } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

export const sortVersesByDate = (p) =>
  Object.keys(p).reduce((arr, verse, i) => {
    const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
    const formattedVerse = { Livre, Chapitre, Verset, Texte: '' } // 1-1-1 to { livre: 1, chapitre: 1, verset: 1}

    if (!arr.find((a) => a.date === p[verse].date)) {
      arr.push({
        date: p[verse].date,
        color: p[verse].color,
        verseIds: [],
        stringIds: {},
        tags: {},
      })
    }

    const dateInArray = arr.find((a) => a.date === p[verse].date)
    if (dateInArray) {
      dateInArray.stringIds[verse] = true
      dateInArray.verseIds.push(formattedVerse)
      dateInArray.verseIds.sort((a, b) => Number(a.Verset) - Number(b.Verset))
      dateInArray.tags = { ...dateInArray.tags, ...p[verse].tags }
    }

    arr.sort((a, b) => Number(b.date) - Number(a.date))

    return arr
  }, [])

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

const TagScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'Tag'>) => {
  const tagId = route.params.tagId
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const isFR = useLanguage()

  const tag = useSelector(
    (state: RootState) => state.user.bible.tags[tagId],
    shallowEqual
  )

  const {
    highlights,
    notes,
    studies,
    naves,
    words,
    strongsGrec,
    strongsHebreu,
  } = useSelector(
    (state) => ({
      highlights: tag.highlights
        ? sortVersesByDate(
            Object.keys(tag.highlights).reduce(
              (arr, id) => ({
                ...arr,
                ...(state.user.bible.highlights[id] && {
                  [id]: state.user.bible.highlights[id],
                }),
              }),
              {}
            )
          )
        : [],
      notes: tag.notes
        ? Object.keys(tag.notes)
            .map((id) => ({ id, reference: '', ...state.user.bible.notes[id] }))
            .filter((c) => c && c.date)
        : [],
      studies: tag.studies
        ? Object.keys(tag.studies)
            .map((id) => state.user.bible.studies[id])
            .filter((c) => c)
        : [],
      naves: tag.naves
        ? Object.keys(tag.naves)
            .map((id) => state.user.bible.naves[id])
            .filter((c) => c)
        : [],
      words: tag.words
        ? Object.keys(tag.words)
            .map((id) => state.user.bible.words[id])
            .filter((c) => c)
        : [],
      strongsHebreu: tag.strongsHebreu
        ? Object.keys(tag.strongsHebreu)
            .map((id) => state.user.bible.strongsHebreu[id])
            .filter((c) => c)
        : [],
      strongsGrec: tag.strongsGrec
        ? Object.keys(tag.strongsGrec)
            .map((id) => state.user.bible.strongsGrec[id])
            .filter((c) => c)
        : [],
    }),
    shallowEqual
  )
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
              {strongsGrec.map((s) => {
                return (
                  <LexiqueResultItem
                    key={s.id + s.title}
                    id={s.id}
                    title={s.title}
                    variant="grec"
                  />
                )
              })}
              {strongsHebreu.map((s) => {
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
              {naves.map((s) => {
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
              {words.map((s) => {
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

            {highlights.map((h) => {
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
            {notes.map((n) => {
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
            <Box row style={{ flexWrap: 'wrap' }}>
              {studies.map((item) => {
                return <StudyItem key={tag.id} study={item} />
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
        onSave={(value) => {
          dispatch(updateTag(titlePrompt.id, value))
        }}
      />
    </Container>
  )
}

export default TagScreen
