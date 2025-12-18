import distanceInWords from 'date-fns/formatDistance'
import enGB from 'date-fns/locale/en-GB'
import fr from 'date-fns/locale/fr'
import React, { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

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
import { makeTagDataSelector } from '~redux/selectors/bible'
import { makeTagByIdSelector } from '~redux/selectors/tags'

const NoteItem = ({ item, t, isFR }: any) => {
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
          // @ts-ignore
          <Text title fontSize={16} scale={-2}>
            {item.title}
          </Text>
        )}
        {!!item.description && (
          <Paragraph scale={-3} scaleLineHeight={-1}>
            {truncate(item.description, 100)}
          </Paragraph>
        )}
        {/* @ts-ignore */}
        <TagList tags={item.tags} />
      </Box>
      <Border />
    </Link>
  )
}

const TagScreen = ({ navigation, route }: StackScreenProps<MainStackProps, 'Tag'>) => {
  const tagId = route.params.tagId
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const isFR = useLanguage()

  // Create memoized selectors
  const selectTagById = useMemo(() => makeTagByIdSelector(), [])
  const selectTagData = useMemo(() => makeTagDataSelector(), [])

  const tag = useSelector((state: RootState) => selectTagById(state, tagId))

  const { highlights, notes, studies, naves, words, strongsGrec, strongsHebreu } = useSelector(
    (state: RootState) => (tag ? selectTagData(state, tag) : {
      highlights: [],
      notes: [],
      studies: [],
      naves: [],
      words: [],
      strongsGrec: [],
      strongsHebreu: [],
    })
  )
  const [titlePrompt, setTitlePrompt] = React.useState<any>(false)

  if (!tag) {
    return (
      <Container>
        <Header hasBackButton title="" />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Cette étiquette n'existe pas...")}
        />
      </Container>
    )
  }

  return (
    <Container>
      <Header
        hasBackButton
        title={tag.name}
        rightComponent={
          <Link onPress={() => setTitlePrompt({ id: tag.id, name: tag.name })} padding>
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
              {naves.map((s: any) => {
                return (
                  // @ts-ignore
                  <NaveResultItem
                    // @ts-ignore
                    key={s.id}
                    // @ts-ignore
                    name_lower={s.id}
                    // @ts-ignore
                    name={s.title}
                    // @ts-ignore
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
            {/* @ts-ignore */}
            <Text padding={20} fontSize={25} title scale={undefined}>
              {t('Surbrillances')}
            </Text>

            {highlights.map((h: any) => {
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
              return <NoteItem t={t} isFR={isFR} key={n.date.toString()} item={n} />
            })}
          </Box>
        )}

        {!!studies.length && (
          <Box>
            <Text padding={20} fontSize={25} title>
              {t('Études')}
            </Text>
            <Box row style={{ flexWrap: 'wrap' }}>
              {studies.map(item => {
                {
                  /* @ts-ignore */
                }
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
        onSave={(value: any) => {
          dispatch(updateTag(titlePrompt.id, value))
        }}
      />
    </Container>
  )
}

export default TagScreen
