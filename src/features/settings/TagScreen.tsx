import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import distanceInWords from 'date-fns/formatDistance'
import React, { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import RenameModal from '~common/RenameModal'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import SectionList from '~common/ui/SectionList'
import HighlightItem from '~features/settings/Verse'
import formatVerseContent from '~helpers/formatVerseContent'
import { Link as LinkModel, LinkType, removeTag, updateTag } from '~redux/modules/user'
import { TagData, useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'

import styled from '@emotion/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import books from '~assets/bible_versions/books-desc'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Empty from '~common/Empty'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import StudyItem from '~features/studies/StudyItem'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import { getDateLocale, type ActiveLanguage } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import { GroupedWordAnnotation, makeTagDataSelector } from '~redux/selectors/bible'
import { makeTagByIdSelector } from '~redux/selectors/tags'
import AnnotationItem from './AnnotationItem'
import TagStrongItem, { TagStrongItemData } from './TagStrongItem'
import TagNaveItem, { TagNaveItemData } from './TagNaveItem'
import TagDictionaryItem, { TagDictionaryItemData } from './TagDictionaryItem'

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

type HighlightData = {
  date: number
  color: string
  verseIds: any[]
  tags: any
}

type UnifiedTagItem =
  | { type: 'highlight'; data: HighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }

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

// Types for SectionList
type TagSectionItem =
  | { type: 'strong-grec'; data: TagStrongItemData }
  | { type: 'strong-hebreu'; data: TagStrongItemData }
  | { type: 'nave'; data: TagNaveItemData }
  | { type: 'word'; data: TagDictionaryItemData }
  | { type: 'highlight'; data: HighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }
  | { type: 'note'; data: any }
  | { type: 'link'; data: LinkItemType }
  | { type: 'study'; data: any }

type TagSection = {
  id: string
  title: string
  count: number
  data: TagSectionItem[]
}

// Section icon component based on section type
const SectionIcon = ({ sectionId }: { sectionId: string }) => {
  switch (sectionId) {
    case 'strongs':
      return <LexiqueIcon color="primary" size={20} />
    case 'naves':
      return <NaveIcon color="quint" size={20} />
    case 'words':
      return <DictionnaryIcon color="secondary" size={20} />
    case 'highlights':
      return <FeatherIcon name="edit-3" size={18} color="color1" />
    case 'notes':
      return <FeatherIcon name="file-text" size={18} color="color2" />
    case 'links':
      return <FeatherIcon name="link" size={18} color="tertiary" />
    case 'studies':
      return <FeatherIcon name="feather" size={18} color="quart" />
    default:
      return null
  }
}

// Section header component for collapsible sections
const TagSectionHeader = ({
  sectionId,
  title,
  count,
  isExpanded,
  toggle,
}: {
  sectionId: string
  title: string
  count: number
  isExpanded: boolean
  toggle: (sectionId: string) => void
}) => (
  <TouchableBox
    row
    onPress={() => toggle(sectionId)}
    alignItems="center"
    py={30}
    px={20}
    backgroundColor="reverse"
    borderBottomWidth={1}
    borderColor="border"
  >
    <Box flex row alignItems="center">
      <Box mr={12}>
        <SectionIcon sectionId={sectionId} />
      </Box>
      <Text>{title}</Text>
      <CountChip>
        <Text fontSize={12} color="default" bold>
          {count}
        </Text>
      </CountChip>
    </Box>
    <AnimatedBox
      width={17}
      height={17}
      center
      style={{
        transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
        transitionProperty: 'transform',
        transitionDuration: 500,
      }}
    >
      <FeatherIcon color="grey" name="chevron-down" size={17} />
    </AnimatedBox>
  </TouchableBox>
)

const TagScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ tagId?: string }>()
  const tagId = params.tagId || ''
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()

  // Create selectors (React Compiler handles memoization)
  const selectTagById = makeTagByIdSelector()
  const selectTagData = makeTagDataSelector()

  const tag = useSelector((state: RootState) => selectTagById(state, tagId))

  const {
    highlights,
    notes,
    links,
    studies,
    naves,
    words,
    strongsGrec,
    strongsHebreu,
    wordAnnotations,
  } = useSelector((state: RootState) =>
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
          wordAnnotations: [],
        }
  )

  // Create unified list of highlights and annotations sorted by date
  const highlightItems: UnifiedTagItem[] = highlights.map((h: HighlightData) => ({
    type: 'highlight' as const,
    data: h,
  }))

  const annotationItems: UnifiedTagItem[] = wordAnnotations.map((a: GroupedWordAnnotation) => ({
    type: 'annotation' as const,
    data: a,
  }))

  const unifiedHighlightsAndAnnotations = [...highlightItems, ...annotationItems].sort(
    (a, b) => Number(b.data.date) - Number(a.data.date)
  )

  const renameModalRef = useRef<BottomSheetModal>(null)
  const [tagToRename, setTagToRename] = useState<{ id: string; name: string } | null>(null)
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  // Expandable section state
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([])

  const toggle = (sectionId: string) => {
    setExpandedSectionIds(s =>
      s.includes(sectionId) ? s.filter(i => i !== sectionId) : [...s, sectionId]
    )
  }

  // Build sections array - only include non-empty sections
  const allSections: (TagSection | false)[] = [
    (strongsGrec.length > 0 || strongsHebreu.length > 0) && {
      id: 'strongs',
      title: 'Strongs',
      count: strongsGrec.length + strongsHebreu.length,
      data: expandedSectionIds.includes('strongs')
        ? [
            ...strongsGrec.map((s: { id: string; title: string }) => ({
              type: 'strong-grec' as const,
              data: s,
            })),
            ...strongsHebreu.map((s: { id: string; title: string }) => ({
              type: 'strong-hebreu' as const,
              data: s,
            })),
          ]
        : [],
    },
    naves.length > 0 && {
      id: 'naves',
      title: t('Thèmes nave'),
      count: naves.length,
      data: expandedSectionIds.includes('naves')
        ? naves.map((s: { id: string; title: string }) => ({ type: 'nave' as const, data: s }))
        : [],
    },
    words.length > 0 && {
      id: 'words',
      title: t('Dictionnaire'),
      count: words.length,
      data: expandedSectionIds.includes('words')
        ? words.map((s: { id: string; title: string }) => ({ type: 'word' as const, data: s }))
        : [],
    },
    unifiedHighlightsAndAnnotations.length > 0 && {
      id: 'highlights',
      title: t('Surbrillances'),
      count: unifiedHighlightsAndAnnotations.length,
      data: expandedSectionIds.includes('highlights')
        ? unifiedHighlightsAndAnnotations.map(item =>
            item.type === 'highlight'
              ? { type: 'highlight' as const, data: item.data }
              : { type: 'annotation' as const, data: item.data }
          )
        : [],
    },
    notes.length > 0 && {
      id: 'notes',
      title: 'Notes',
      count: notes.length,
      data: expandedSectionIds.includes('notes')
        ? notes.map((n: any) => ({ type: 'note' as const, data: n }))
        : [],
    },
    links.length > 0 && {
      id: 'links',
      title: t('Liens'),
      count: links.length,
      data: expandedSectionIds.includes('links')
        ? links.map((l: LinkItemType) => ({ type: 'link' as const, data: l }))
        : [],
    },
    studies.length > 0 && {
      id: 'studies',
      title: t('Études'),
      count: studies.length,
      data: expandedSectionIds.includes('studies')
        ? studies.map((s: any) => ({ type: 'study' as const, data: s }))
        : [],
    },
  ]

  const sections = allSections.filter((s): s is TagSection => !!s)

  // Render item based on type
  const renderItem = ({ item }: { item: TagSectionItem }) => {
    switch (item.type) {
      case 'strong-grec':
        return <TagStrongItem item={item.data} variant="grec" />
      case 'strong-hebreu':
        return <TagStrongItem item={item.data} variant="hebreu" />
      case 'nave':
        return <TagNaveItem item={item.data} />
      case 'word':
        return <TagDictionaryItem item={item.data} />
      case 'highlight':
        return (
          <HighlightItem
            color={item.data.color}
            date={item.data.date}
            verseIds={item.data.verseIds}
            tags={item.data.tags}
          />
        )
      case 'annotation':
        return <AnnotationItem item={item.data} />
      case 'note':
        return <NoteItem t={t} lang={lang} item={item.data} />
      case 'link':
        return <LinkItem t={t} lang={lang} item={item.data} />
      case 'study':
        return <StudyItem study={item.data} />
      default:
        return null
    }
  }

  const isEmpty = sections.length === 0

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
      wordAnnotations,
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
      {isEmpty ? (
        <Box flex pt={40} px={20}>
          <Empty
            icon={require('~assets/images/empty-state-icons/tag.svg')}
            message={t("Vous n'avez rien enregistré avec cette étiquette...")}
          />
        </Box>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderSectionHeader={({ section }) => {
            const tagSection = section as TagSection
            return (
              <TagSectionHeader
                sectionId={tagSection.id}
                title={tagSection.title}
                count={tagSection.count}
                isExpanded={expandedSectionIds.includes(tagSection.id)}
                toggle={toggle}
              />
            )
          }}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
        />
      )}
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
