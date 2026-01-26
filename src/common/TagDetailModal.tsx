import { BottomSheetHandle, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import distanceInWords from 'date-fns/formatDistance'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled from '@emotion/native'

import books from '~assets/bible_versions/books-desc'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Empty from '~common/Empty'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import ModalHeader from '~common/ModalHeader'
import NaveIcon from '~common/NaveIcon'
import PopOverMenu from '~common/PopOverMenu'
import RenameModal from '~common/RenameModal'
import TagList from '~common/TagList'
import Border from '~common/ui/Border'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Paragraph from '~common/ui/Paragraph'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import AnnotationItem from '~features/settings/AnnotationItem'
import TagDictionaryItem, { TagDictionaryItemData } from '~features/settings/TagDictionaryItem'
import TagNaveItem, { TagNaveItemData } from '~features/settings/TagNaveItem'
import TagStrongItem, { TagStrongItemData } from '~features/settings/TagStrongItem'
import { TagData, useCreateTabGroupFromTag } from '~features/settings/useCreateTabGroupFromTag'
import HighlightItem from '~features/settings/Verse'
import StudyItem from '~features/studies/StudyItem'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import formatVerseContent from '~helpers/formatVerseContent'
import { getDateLocale, type ActiveLanguage } from '~helpers/languageUtils'
import { linkTypeConfig } from '~helpers/fetchOpenGraphData'
import truncate from '~helpers/truncate'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import useLanguage from '~helpers/useLanguage'
import { LinkType, removeTag, updateTag } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import { GroupedWordAnnotation, makeTagDataSelector } from '~redux/selectors/bible'
import { makeTagByIdSelector } from '~redux/selectors/tags'
import { tagDetailModalAtom } from '~state/app'

type LinkModel = {
  url: string
  date: number
  linkType?: LinkType
  customTitle?: string
  ogData?: { title?: string }
  tags?: { [key: string]: any }
}

type HighlightData = {
  date: number
  color: string
  verseIds: any[]
  tags: any
}

type UnifiedTagItem =
  | { type: 'highlight'; data: HighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }

type LinkItemType = LinkModel & { id: string }

// Section types
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

// Section icon component
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

// Section header component
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

// Hook to fetch tag data
const useTagData = (tagId: string) => {
  const selectTagById = makeTagByIdSelector()
  const selectTagData = makeTagDataSelector()

  const tag = useSelector((state: RootState) => selectTagById(state, tagId))

  const tagData = useSelector((state: RootState) =>
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

  return { tag, ...tagData }
}

const TagDetailContent = ({ tagId }: { tagId: string }) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const insets = useSafeAreaInsets()
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([])

  const {
    tag,
    highlights,
    notes,
    links,
    studies,
    naves,
    words,
    strongsGrec,
    strongsHebreu,
    wordAnnotations,
  } = useTagData(tagId)

  // Create unified list of highlights and annotations
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

  const toggle = (sectionId: string) => {
    setExpandedSectionIds(s =>
      s.includes(sectionId) ? s.filter(i => i !== sectionId) : [...s, sectionId]
    )
  }

  // Build sections array
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

  if (!tag) {
    return (
      <Box flex pt={40} px={20}>
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Cette étiquette n'existe pas...")}
        />
      </Box>
    )
  }

  if (isEmpty) {
    return (
      <Box flex pt={40} px={20}>
        <Empty
          icon={require('~assets/images/empty-state-icons/tag.svg')}
          message={t("Vous n'avez rien enregistré avec cette étiquette...")}
        />
      </Box>
    )
  }

  return (
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
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    />
  )
}

const TagDetailModal = () => {
  const props = useAtomValue(tagDetailModalAtom)
  const setProps = useSetAtom(tagDetailModalAtom)
  const { ref, open, close } = useBottomSheetModal()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [tagToRename, setTagToRename] = useState<{ id: string; name: string } | null>(null)
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  // Fetch tag data at modal level for header
  const {
    tag,
    highlights,
    notes,
    links,
    studies,
    naves,
    words,
    strongsGrec,
    strongsHebreu,
    wordAnnotations,
  } = useTagData(props ? props.tagId : '')

  useEffect(() => {
    if (props) {
      open()
    }
  }, [props, open])

  const handleClose = () => {
    close()
    setProps(false)
  }

  const handleDismiss = () => {
    setProps(false)
  }

  const handleDelete = () => {
    if (!tag) return
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: () => {
          dispatch(removeTag(tag.id))
          handleClose()
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
    handleClose()
  }

  const renderHandle = (handleProps: React.ComponentProps<typeof BottomSheetHandle>) => (
    <>
      <BottomSheetHandle {...handleProps} />
      <ModalHeader
        title={tag?.name || t('Étiquette')}
        rightComponent={
          tag ? (
            <Box>
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
            </Box>
          ) : undefined
        }
      />
    </>
  )

  if (!props) return null

  return (
    <>
      <BottomSheetModal
        ref={ref}
        topInset={insets.top}
        enablePanDownToClose
        snapPoints={['90%']}
        backdropComponent={renderBackdrop}
        activeOffsetY={[-20, 20]}
        onDismiss={handleDismiss}
        handleComponent={renderHandle}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <TagDetailContent tagId={props.tagId} />
        </BottomSheetView>
      </BottomSheetModal>

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
    </>
  )
}

export default TagDetailModal
