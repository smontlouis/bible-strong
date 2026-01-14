import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import distanceInWords from 'date-fns/formatDistance'
import React, { useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import RenameModal from '~common/RenameModal'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import ScrollView from '~common/ui/ScrollView'
import HighlightItem from '~features/settings/Verse'
import formatVerseContent from '~helpers/formatVerseContent'
import { updateTag, removeTag, Link as LinkModel, LinkType } from '~redux/modules/user'
import { useCreateTabGroupFromTag, TagData } from './useCreateTabGroupFromTag'

import styled from '@emotion/native'
import { useTranslation } from 'react-i18next'
import books from '~assets/bible_versions/books-desc'
import Empty from '~common/Empty'
import Link from '~common/Link'
import TagList from '~common/TagList'
import Accordion from '~common/ui/Accordion'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import DictionnaryResultItem from '~features/dictionnary/DictionaryResultItem'
import LexiqueResultItem from '~features/lexique/LexiqueResultItem'
import NaveResultItem from '~features/nave/NaveResultItem'
import StudyItem from '~features/studies/StudyItem'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale, type ActiveLanguage } from '~helpers/languageUtils'
import { RootState } from '~redux/modules/reducer'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { makeTagByIdSelector } from '~redux/selectors/tags'

const NoteItem = ({ item, t, lang }: { item: any; t: any; lang: ActiveLanguage }) => {
  const [Livre, Chapitre, Verset] = item.id.split('-')
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: getDateLocale(lang),
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
        <TagList tags={item.tags} />
      </Box>
      <Border />
    </Link>
  )
}

const LinkTypeIcon = styled(Box)<{ bgColor: string }>(({ bgColor }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: bgColor,
  marginRight: 10,
  alignItems: 'center',
  justifyContent: 'center',
}))

type LinkItemType = LinkModel & { id: string }

const LinkItem = ({ item, t, lang }: { item: LinkItemType; t: any; lang: ActiveLanguage }) => {
  const [Livre, Chapitre, Verset] = item.id.split('-').map(Number)
  const { title } = formatVerseContent([{ Livre, Chapitre, Verset }])
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: getDateLocale(lang),
  })
  const config = linkTypeConfig[item.linkType as LinkType] || linkTypeConfig.website
  const displayTitle = item.customTitle || item.ogData?.title || item.url

  return (
    <Link
      route="BibleView"
      params={{
        isReadOnly: true,
        book: books[Livre - 1],
        chapter: Chapitre,
        verse: Verset,
      }}
    >
      <Box padding={20} row>
        <LinkTypeIcon bgColor={config.color}>
          {config.textIcon ? (
            <Text bold fontSize={12} color="white">
              {config.textIcon}
            </Text>
          ) : (
            <FeatherIcon name={config.icon as any} size={14} color="white" />
          )}
        </LinkTypeIcon>
        <Box flex>
          <Text color="darkGrey" bold fontSize={11}>
            {title} - {t('Il y a {{formattedDate}}', { formattedDate })}
          </Text>
          {/* @ts-ignore */}
          <Text title fontSize={16} scale={-2}>
            {truncate(displayTitle, 50)}
          </Text>
          <Paragraph scale={-3} scaleLineHeight={-1} color="tertiary" numberOfLines={1}>
            {item.url}
          </Paragraph>
          {item.tags && Object.keys(item.tags).length > 0 && <TagList tags={item.tags} />}
        </Box>
      </Box>
      <Border />
    </Link>
  )
}

const CountChip = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  backgroundColor: theme.colors.border,
  paddingVertical: 2,
  paddingHorizontal: 8,
  marginLeft: 8,
}))

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <Box row alignItems="center">
    <Text fontSize={18} bold>
      {title}
    </Text>
    <CountChip>
      <Text fontSize={12} color="default" bold>
        {count}
      </Text>
    </CountChip>
  </Box>
)

const TagScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ tagId?: string }>()
  const tagId = params.tagId || ''
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()

  // Create memoized selectors
  const selectTagById = useMemo(() => makeTagByIdSelector(), [])
  const selectTagData = useMemo(() => makeTagDataSelector(), [])

  const tag = useSelector((state: RootState) => selectTagById(state, tagId))

  const { highlights, notes, links, studies, naves, words, strongsGrec, strongsHebreu } =
    useSelector((state: RootState) =>
      tag
        ? selectTagData(state, tag)
        : {
            highlights: [],
            notes: [],
            links: [],
            studies: [],
            naves: [],
            words: [],
            strongsGrec: [],
            strongsHebreu: [],
          }
    )
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [tagToRename, setTagToRename] = useState<{ id: string; name: string } | null>(null)
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  const handleDelete = () => {
    if (!tag) return
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: () => {
          dispatch(removeTag(tag.id))
          router.back()
        },
      },
    ])
  }

  const handleOpenInTabGroup = () => {
    if (!tag) return

    const tagData: TagData = {
      highlights,
      notes,
      links,
      studies,
      naves,
      words,
      strongsGrec,
      strongsHebreu,
    }

    createTabGroupFromTag(tag, tagData)
  }

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
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() => {
                    setTagToRename({ id: tag.id, name: tag.name })
                    renameModalRef.current?.present()
                  }}
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="edit-3" size={15} />
                    <Text marginLeft={10}>{t('Éditer')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={handleOpenInTabGroup}>
                  <Box row alignItems="center">
                    <FeatherIcon name="layers" size={15} />
                    <Text marginLeft={10}>{t('tabs.createGroupFromTag')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={handleDelete}>
                  <Box row alignItems="center">
                    <FeatherIcon name="trash-2" size={15} color="quart" />
                    <Text marginLeft={10} color="quart">
                      {t('Supprimer')}
                    </Text>
                  </Box>
                </MenuOption>
              </>
            }
          />
        }
      />
      <ScrollView>
        {!highlights.length &&
          !notes.length &&
          !links.length &&
          !studies.length &&
          !naves.length &&
          !words.length &&
          !strongsGrec.length &&
          !strongsHebreu.length && (
            <Box pt={40} px={20}>
              <Empty
                icon={require('~assets/images/empty-state-icons/tag.svg')}
                message={t("Vous n'avez rien enregistré avec cette étiquette...")}
              />
            </Box>
          )}
        {(!!strongsGrec.length || !!strongsHebreu.length) && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={
                <SectionHeader title="Strongs" count={strongsGrec.length + strongsHebreu.length} />
              }
            >
              <Box row wrap>
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
            </Accordion>
          </Box>
        )}
        {!!naves.length && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={<SectionHeader title={t('Thèmes nave')} count={naves.length} />}
            >
              <Box row wrap>
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
            </Accordion>
          </Box>
        )}
        {!!words.length && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={<SectionHeader title={t('Dictionnaire')} count={words.length} />}
            >
              <Box row wrap>
                {words.map(s => {
                  return <DictionnaryResultItem key={s.id} word={s.title} />
                })}
              </Box>
            </Accordion>
          </Box>
        )}
        {!!highlights.length && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={<SectionHeader title={t('Surbrillances')} count={highlights.length} />}
            >
              {highlights.map((h: any) => {
                const { color, date, verseIds, tags } = h
                return <HighlightItem key={date} {...{ color, date, verseIds, tags }} />
              })}
            </Accordion>
          </Box>
        )}

        {!!notes.length && (
          <Box px={20}>
            <Accordion defaultExpanded title={<SectionHeader title="Notes" count={notes.length} />}>
              {notes.map(n => {
                return <NoteItem t={t} lang={lang} key={n.date.toString()} item={n} />
              })}
            </Accordion>
          </Box>
        )}

        {!!links.length && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={<SectionHeader title={t('Liens')} count={links.length} />}
            >
              {links.map(l => {
                return <LinkItem t={t} lang={lang} key={l.id} item={l} />
              })}
            </Accordion>
          </Box>
        )}

        {!!studies.length && (
          <Box px={20}>
            <Accordion
              defaultExpanded
              title={<SectionHeader title={t('Études')} count={studies.length} />}
            >
              <Box row style={{ flexWrap: 'wrap' }}>
                {studies.map(item => {
                  {
                    /* @ts-ignore */
                  }
                  return <StudyItem key={tag.id} study={item} />
                })}
              </Box>
            </Accordion>
          </Box>
        )}
      </ScrollView>
      <RenameModal
        bottomSheetRef={renameModalRef}
        title={t("Renommer l'étiquette")}
        placeholder={t("Nom de l'étiquette")}
        initialValue={tagToRename?.name}
        onSave={value => {
          if (tagToRename) {
            dispatch(updateTag(tagToRename.id, value))
          }
        }}
      />
    </Container>
  )
}

export default TagScreen
