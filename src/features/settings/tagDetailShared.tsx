import React from 'react'
import distanceInWords from 'date-fns/formatDistance'
import styled from '@emotion/native'

import DictionnaryIcon from '~common/DictionnaryIcon'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import EntityChipList from '~common/EntityChipList'
import Border from '~common/ui/Border'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import { getDateLocale, type ActiveLanguage } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import { getNoteTitle } from '~helpers/getNoteTitle'
import type { TagsObj } from '~common/types'
import { LinkType, Link as LinkModel, Note, Study } from '~redux/modules/user'
import { GroupedWordAnnotation } from '~redux/selectors/bible'
import type { TagStrongItemData } from './TagStrongItem'
import type { TagNaveItemData } from './TagNaveItem'
import type { TagDictionaryItemData } from './TagDictionaryItem'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { createExternalLinkEndpointFromLink } from '~features/studyRelations/endpoints'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

export type HighlightData = {
  date: number
  color: string
  verseIds: { Livre: number; Chapitre: number; Verset: number; Texte: string }[]
  tags: TagsObj
}

export type LinkItemType = LinkModel & { id: string; reference?: string; verseKeys?: string[] }

export type NoteItemType = Note & { id: string; reference?: string; verseKeys?: string[] }

type Translate = (key: string, options?: Record<string, unknown>) => string

const getFirstVerseLocation = (verseKeys?: string[]) => {
  const [Livre, Chapitre, Verset] = verseKeys?.[0]?.split('-').map(Number) || []
  if (!Livre || !Chapitre || !Verset) return null
  return { Livre, Chapitre, Verset }
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
  | { type: 'note'; data: NoteItemType }
  | { type: 'link'; data: LinkItemType }
  | { type: 'study'; data: Study }

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
  item: NoteItemType
  t: Translate
  lang: ActiveLanguage
}) => {
  const pushRouteOnce = usePushRouteOnce()
  const location = getFirstVerseLocation(item.verseKeys)
  const { title } = location
    ? formatVerseContent([location])
    : { title: item.reference || t('Note') }
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: getDateLocale(lang),
  })
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const metadataLabel = title ? `${title} - ${relativeDate}` : relativeDate
  const noteTitle = getNoteTitle(item, '')

  const content = (
    <Box padding={20}>
      <Box row justifyContent="space-between">
        <Text color="darkGrey" bold fontSize={11}>
          {metadataLabel}
        </Text>
      </Box>
      {!!noteTitle && (
        <Text title fontSize={16}>
          {noteTitle}
        </Text>
      )}
      {!!item.description && item.description !== noteTitle && (
        <Paragraph scale={-3} scaleLineHeight={-1}>
          {truncate(item.description, 100)}
        </Paragraph>
      )}
      <EntityChipList tags={item.tags} />
    </Box>
  )

  const openNote = () => {
    pushRouteOnce({
      pathname: '/note',
      params: {
        noteId: item.id,
        ...(item.verseKeys?.length ? { verseKeys: JSON.stringify(item.verseKeys) } : {}),
      },
    })
  }

  return (
    <TouchableBox onPress={openNote}>
      {content}
      <Border />
    </TouchableBox>
  )
}

export const LinkItem = ({
  item,
  t,
  lang,
}: {
  item: LinkItemType
  t: Translate
  lang: ActiveLanguage
}) => {
  const pushRouteOnce = usePushRouteOnce()
  const location = getFirstVerseLocation(item.verseKeys)
  const { title } = location
    ? formatVerseContent([location])
    : { title: item.reference || t('Lien') }
  const formattedDate = distanceInWords(Number(item.date), Date.now(), {
    locale: getDateLocale(lang),
  })
  const config = linkTypeConfig[item.linkType as LinkType] || linkTypeConfig.website
  const iconName = config.icon as React.ComponentProps<typeof FeatherIcon>['name']
  const displayTitle = item.customTitle || item.ogData?.title || item.url
  const relativeDate = t('Il y a {{formattedDate}}', { formattedDate })
  const metadataLabel = title ? `${title} - ${relativeDate}` : relativeDate
  const relationEndpoint: Extract<RelationEndpoint, { type: 'externalLink' }> =
    createExternalLinkEndpointFromLink(item.id, {
      url: item.url,
      customTitle: displayTitle,
    })
  const relationCount = useRelationCount(relationEndpoint)
  const openEntityRelations = useOpenEntityRelations()

  const content = (
    <>
      <Box padding={20} row>
        <LinkTypeIcon bgColor={config.color}>
          {config.textIcon ? (
            <Text bold fontSize={12} color="white">
              {config.textIcon}
            </Text>
          ) : (
            <FeatherIcon name={iconName} size={14} color="white" />
          )}
        </LinkTypeIcon>
        <Box flex>
          <Text color="darkGrey" bold fontSize={11}>
            {metadataLabel}
          </Text>
          <Text title fontSize={16}>
            {truncate(displayTitle, 50)}
          </Text>
          <Paragraph scale={-3} scaleLineHeight={-1} color="tertiary" numberOfLines={1}>
            {item.url}
          </Paragraph>
          <EntityChipList
            tags={item.tags}
            relationCount={relationCount}
            onRelationPress={() => openEntityRelations(relationEndpoint)}
          />
        </Box>
      </Box>
    </>
  )

  const openLink = () => {
    pushRouteOnce({
      pathname: '/link',
      params: {
        linkId: item.id,
        ...(item.verseKeys?.length ? { verseKeys: item.verseKeys.join(',') } : {}),
      },
    })
  }

  return (
    <TouchableBox onPress={openLink}>
      {content}
      <Border />
    </TouchableBox>
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
    py={20}
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

export const createSection = <T extends { id: string | number; title?: string }>({
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
  strongsGrec: TagStrongItemData[],
  strongsHebreu: TagStrongItemData[],
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
    strongsGrec: TagStrongItemData[]
    strongsHebreu: TagStrongItemData[]
    naves: TagNaveItemData[]
    words: TagDictionaryItemData[]
    highlights: HighlightData[]
    notes: NoteItemType[]
    links: LinkItemType[]
    studies: Study[]
    wordAnnotations: GroupedWordAnnotation[]
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
