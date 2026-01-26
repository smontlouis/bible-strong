import React from 'react'
import distanceInWords from 'date-fns/formatDistance'
import styled from '@emotion/native'

import books from '~assets/bible_versions/books-desc'
import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import { getDateLocale, type ActiveLanguage } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import { LinkType, Link as LinkModel } from '~redux/modules/user'
import { GroupedWordAnnotation } from '~redux/selectors/bible'
import type { TagStrongItemData } from './TagStrongItem'
import type { TagNaveItemData } from './TagNaveItem'
import type { TagDictionaryItemData } from './TagDictionaryItem'

// Types
export type LinkItemType = LinkModel & { id: string }

export type HighlightData = {
  date: number
  color: string
  verseIds: any[]
  tags: any
}

export type UnifiedTagItem =
  | { type: 'highlight'; data: HighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }

export type TagSectionItem =
  | { type: 'strong-grec'; data: TagStrongItemData }
  | { type: 'strong-hebreu'; data: TagStrongItemData }
  | { type: 'nave'; data: TagNaveItemData }
  | { type: 'word'; data: TagDictionaryItemData }
  | { type: 'highlight'; data: HighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }
  | { type: 'note'; data: any }
  | { type: 'link'; data: LinkItemType }
  | { type: 'study'; data: any }

export type TagSection = {
  id: string
  title: string
  count: number
  data: TagSectionItem[]
}

// Styled components
const LinkTypeIcon = styled(Box)<{ bgColor: string }>(({ bgColor }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: bgColor,
  marginRight: 10,
  alignItems: 'center',
  justifyContent: 'center',
}))

export const CountChip = styled(Box)(({ theme }) => ({
  borderRadius: 12,
  backgroundColor: theme.colors.border,
  paddingVertical: 2,
  paddingHorizontal: 8,
  marginLeft: 8,
}))

// Components
export const NoteItem = ({
  item,
  t,
  lang,
}: {
  item: any
  t: (key: string, options?: any) => string
  lang: ActiveLanguage
}) => {
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

export const LinkItem = ({
  item,
  t,
  lang,
}: {
  item: LinkItemType
  t: (key: string, options?: any) => string
  lang: ActiveLanguage
}) => {
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

export const SectionIcon = ({ sectionId }: { sectionId: string }) => {
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

export const TagSectionHeader = ({
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

// Helper to build sections
type SectionConfig<T> = {
  id: string
  title: string
  items: T[]
  type: TagSectionItem['type']
  isExpanded: boolean
}

export const createSection = <T extends { id: string; title?: string }>({
  id,
  title,
  items,
  type,
  isExpanded,
}: SectionConfig<T>): TagSection | null => {
  if (items.length === 0) return null
  return {
    id,
    title,
    count: items.length,
    data: isExpanded ? items.map(item => ({ type, data: item }) as TagSectionItem) : [],
  }
}

// Combined Strong section helper
export const createStrongsSection = (
  strongsGrec: any[],
  strongsHebreu: any[],
  isExpanded: boolean
): TagSection | null => {
  if (strongsGrec.length === 0 && strongsHebreu.length === 0) return null
  return {
    id: 'strongs',
    title: 'Strongs',
    count: strongsGrec.length + strongsHebreu.length,
    data: isExpanded
      ? [
          ...strongsGrec.map(s => ({ type: 'strong-grec' as const, data: s })),
          ...strongsHebreu.map(s => ({ type: 'strong-hebreu' as const, data: s })),
        ]
      : [],
  }
}

// Unified highlights and annotations section helper
export const createHighlightsSection = (
  highlights: HighlightData[],
  wordAnnotations: GroupedWordAnnotation[],
  isExpanded: boolean,
  title: string
): TagSection | null => {
  const highlightItems: UnifiedTagItem[] = highlights.map(h => ({
    type: 'highlight' as const,
    data: h,
  }))

  const annotationItems: UnifiedTagItem[] = wordAnnotations.map(a => ({
    type: 'annotation' as const,
    data: a,
  }))

  const unified = [...highlightItems, ...annotationItems].sort(
    (a, b) => Number(b.data.date) - Number(a.data.date)
  )

  if (unified.length === 0) return null

  return {
    id: 'highlights',
    title,
    count: unified.length,
    data: isExpanded
      ? unified.map(item =>
          item.type === 'highlight'
            ? { type: 'highlight' as const, data: item.data }
            : { type: 'annotation' as const, data: item.data }
        )
      : [],
  }
}

// Build all sections from tag data
export const buildTagSections = (
  tagData: {
    strongsGrec: any[]
    strongsHebreu: any[]
    naves: any[]
    words: any[]
    highlights: any[]
    notes: any[]
    links: any[]
    studies: any[]
    wordAnnotations: any[]
  },
  expandedSectionIds: string[],
  t: (key: string) => string
): TagSection[] => {
  const isExpanded = (id: string) => expandedSectionIds.includes(id)

  const allSections = [
    createStrongsSection(tagData.strongsGrec, tagData.strongsHebreu, isExpanded('strongs')),
    createSection({
      id: 'naves',
      title: t('Thèmes nave'),
      items: tagData.naves,
      type: 'nave',
      isExpanded: isExpanded('naves'),
    }),
    createSection({
      id: 'words',
      title: t('Dictionnaire'),
      items: tagData.words,
      type: 'word',
      isExpanded: isExpanded('words'),
    }),
    createHighlightsSection(
      tagData.highlights,
      tagData.wordAnnotations,
      isExpanded('highlights'),
      t('Surbrillances')
    ),
    createSection({
      id: 'notes',
      title: 'Notes',
      items: tagData.notes,
      type: 'note',
      isExpanded: isExpanded('notes'),
    }),
    createSection({
      id: 'links',
      title: t('Liens'),
      items: tagData.links,
      type: 'link',
      isExpanded: isExpanded('links'),
    }),
    createSection({
      id: 'studies',
      title: t('Études'),
      items: tagData.studies,
      type: 'study',
      isExpanded: isExpanded('studies'),
    }),
  ]

  return allSections.filter((s): s is TagSection => s !== null)
}
