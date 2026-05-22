import { BottomSheetFlashList, BottomSheetModal } from '@gorhom/bottom-sheet'
import { useTheme } from '@emotion/react'
import Fuse from 'fuse.js'
import { ComponentProps, Ref, useDeferredValue, useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AlphabetList from '~common/AlphabetList'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import Empty from '~common/Empty'
import LexiqueIcon from '~common/LexiqueIcon'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useBibleVerses from '~helpers/useBibleVerses'
import useDebounce from '~helpers/useDebounce'
import loadLexiqueByLetter, { type LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import { removeBreakLines } from '~helpers/utils'
import { RootState } from '~redux/modules/reducer'
import { createStudyRelation } from '~redux/modules/user'
import type { AppDispatch } from '~redux/store'
import { getEndpointFallbackLabel, type RelationEndpoint } from './domain'
import {
  getNoteTargetItems,
  getStudyTargetItems,
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from './targetSearch'

type BrowseMode = 'note' | 'study' | 'strong'
type MatchRange = [number, number]
type MatchedRelationTargetResult = RelationTargetResult & {
  matches?: readonly Fuse.FuseResultMatch[]
}

type Props = {
  ref?: Ref<BottomSheetModal | null>
  title?: string
  sourceEndpoint: RelationEndpoint | null
  onCreated?: () => void
  allowedTypes?: RelationEndpoint['type'][]
}

const browseModeLabelKeys: Record<BrowseMode, string> = {
  note: 'Notes',
  study: 'Études',
  strong: 'Strong',
}

const targetIconConfig: Record<
  RelationEndpoint['type'],
  {
    name: ComponentProps<typeof FeatherIcon>['name']
    color: string
  }
> = {
  verse: { name: 'book-open', color: 'color1' },
  note: { name: 'file-text', color: 'color2' },
  study: { name: 'feather', color: 'tertiary' },
  strong: { name: 'hash', color: 'primary' },
}

const getStrongCode = (strong: LexiqueRow) =>
  String(
    (strong as LexiqueRow & { code?: string | number }).Code ??
      (strong as { code?: string | number }).code ??
      ''
  )

const getStrongOriginalWord = (strong: LexiqueRow) =>
  'Grec' in strong ? strong.Grec : strong.Hebreu

const getStrongEndpoint = (strong: LexiqueRow): RelationEndpoint => ({
  type: 'strong',
  language: strong.lexiqueType === 'Grec' ? 'greek' : 'hebrew',
  code: getStrongCode(strong),
  label: strong.Mot,
  originalWord: getStrongOriginalWord(strong),
})

const getStrongSubtitle = (strong: LexiqueRow) =>
  `${strong.lexiqueType} · ${strong.lexiqueType === 'Grec' ? 'G' : 'H'}${getStrongCode(strong)}`

const getSourceEndpointSubtitle = (
  endpoint: RelationEndpoint | null,
  t: (key: string) => string
) => {
  if (!endpoint) return undefined

  switch (endpoint.type) {
    case 'verse':
      return getEndpointFallbackLabel(endpoint)
    case 'note':
      return t('Note')
    case 'study':
      return t('Étude')
    case 'strong':
      return endpoint.originalWord || endpoint.label || getEndpointFallbackLabel(endpoint)
  }
}

const isDatabaseError = (value: unknown): value is { error: string } =>
  typeof value === 'object' && value !== null && 'error' in value

function removeAccents(obj: string): string
function removeAccents<T>(obj: T): T
function removeAccents<T>(obj: T) {
  if (typeof obj === 'string' || obj instanceof String) {
    return obj.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  return obj
}

const getFuzzyValue = <T,>(obj: T, path: string | string[]): readonly string[] | string => {
  const value = Fuse.config.getFn(obj, path)
  return Array.isArray(value)
    ? value.map(item => removeAccents(String(item)))
    : removeAccents(value)
}

const fuzzyOptions: Fuse.IFuseOptions<RelationTargetResult> = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'description', weight: 0.3 },
  ],
  threshold: 0.22,
  ignoreLocation: true,
  ignoreFieldNorm: true,
  includeMatches: true,
  minMatchCharLength: 3,
  getFn: getFuzzyValue,
}

const normalizeSearchText = (value: string) => removeAccents(value).toLowerCase()
const normalizeDisplayedText = (value: string) => removeBreakLines(value)

const findExactNormalizedRange = (value: string | undefined, keyword: string): MatchRange[] => {
  if (!value) return []

  const normalizedValue = normalizeSearchText(value)
  const normalizedKeyword = normalizeSearchText(keyword.trim())
  if (normalizedKeyword.length < 3) return []

  const start = normalizedValue.indexOf(normalizedKeyword)
  if (start === -1) return []

  return [[start, start + normalizedKeyword.length - 1]]
}

const getExactMatches = (
  target: RelationTargetResult,
  keyword: string
): readonly Fuse.FuseResultMatch[] => {
  const titleRanges = findExactNormalizedRange(target.title, keyword)
  const descriptionRanges = findExactNormalizedRange(target.description, keyword)
  const matches: Fuse.FuseResultMatch[] = []

  if (titleRanges.length) {
    matches.push({ key: 'title', value: target.title, indices: titleRanges })
  }
  if (target.description && descriptionRanges.length) {
    matches.push({ key: 'description', value: target.description, indices: descriptionRanges })
  }

  return matches
}

const searchWithMatches = (
  targets: RelationTargetResult[],
  keyword: string
): MatchedRelationTargetResult[] => {
  const trimmed = keyword.trim()
  if (!trimmed) return targets

  return new Fuse(targets, fuzzyOptions)
    .search(removeAccents(trimmed))
    .map(result => ({
      ...result.item,
      matches: getExactMatches(result.item, trimmed),
    }))
    .filter(result => result.matches?.length)
}

const mergeRanges = (ranges: readonly MatchRange[]) =>
  ranges
    .slice()
    .sort((a, b) => a[0] - b[0])
    .reduce<MatchRange[]>((merged, range) => {
      const previous = merged[merged.length - 1]
      if (previous && range[0] <= previous[1] + 1) {
        merged[merged.length - 1] = [previous[0], Math.max(previous[1], range[1])]
      } else {
        merged.push([range[0], range[1]])
      }
      return merged
    }, [])

const filterUsefulRanges = (ranges: readonly MatchRange[]) =>
  mergeRanges(ranges).filter(([start, end]) => end - start + 1 >= 3)

const getExcerpt = (value: string, ranges: readonly MatchRange[], context = 26) => {
  const firstRange = ranges[0]
  const sourceText = normalizeDisplayedText(value)
  const normalizedSourceText = normalizeSearchText(sourceText)
  const matchedText = firstRange ? value.slice(firstRange[0], firstRange[1] + 1) : ''
  const normalizedMatchedText = normalizeSearchText(matchedText)
  const displayedMatchStart = normalizedMatchedText
    ? normalizedSourceText.indexOf(normalizedMatchedText)
    : -1

  if (displayedMatchStart === -1) {
    return {
      text: sourceText,
      ranges: [],
    }
  }

  const displayedRange: MatchRange = [
    displayedMatchStart,
    displayedMatchStart + normalizedMatchedText.length - 1,
  ]

  if (!firstRange || value.length <= 90) {
    return {
      text: sourceText,
      ranges: [displayedRange],
    }
  }

  const start = Math.max(0, displayedRange[0] - context)
  const end = Math.min(sourceText.length, displayedRange[1] + context)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < sourceText.length ? '...' : ''
  const text = `${prefix}${sourceText.slice(start, end)}${suffix}`
  const offset = start - prefix.length

  return {
    text,
    ranges: [
      [
        Math.max(0, displayedRange[0] - offset),
        Math.min(text.length - 1, displayedRange[1] - offset),
      ],
    ],
  }
}

const HighlightedText = ({
  value,
  ranges,
  bold,
  color = 'tertiary',
}: {
  value: string
  ranges?: readonly MatchRange[]
  bold?: boolean
  color?: string
}) => {
  const mergedRanges = ranges ? filterUsefulRanges(ranges) : []

  if (!mergedRanges.length) {
    return (
      <Text
        bold={bold}
        fontSize={bold ? 16 : 13}
        color={bold ? undefined : color}
        numberOfLines={1}
      >
        {normalizeDisplayedText(value)}
      </Text>
    )
  }

  const { text, ranges: excerptRanges } = getExcerpt(value, mergedRanges)
  const chunks: { text: string; highlighted: boolean }[] = []
  let cursor = 0

  excerptRanges.forEach(([start, end]) => {
    if (start > cursor) {
      chunks.push({ text: text.slice(cursor, start), highlighted: false })
    }
    chunks.push({ text: text.slice(start, end + 1), highlighted: true })
    cursor = end + 1
  })

  if (cursor < text.length) {
    chunks.push({ text: text.slice(cursor), highlighted: false })
  }

  return (
    <Text bold={bold} fontSize={bold ? 16 : 13} color={bold ? undefined : color} numberOfLines={1}>
      {chunks.map((chunk, index) => (
        <Text
          key={`${chunk.text}-${index}`}
          bold
          fontSize={bold ? 16 : 13}
          color={chunk.highlighted ? 'primary' : bold ? undefined : color}
          bg={chunk.highlighted ? 'lightPrimary' : undefined}
        >
          {chunk.text}
        </Text>
      ))}
    </Text>
  )
}

const getMatchForKey = (item: MatchedRelationTargetResult, key: string) =>
  item.matches?.find(match => match.key === key)

const getVerseIds = (endpoint: RelationEndpoint) =>
  endpoint.type === 'verse'
    ? endpoint.verseKeys.map(key => {
        const [Livre, Chapitre, Verset] = key.split('-')
        return { Livre, Chapitre, Verset }
      })
    : []

const TargetIcon = ({ type }: { type: RelationEndpoint['type'] }) => {
  const config = targetIconConfig[type]
  return (
    <Box
      width={36}
      height={36}
      borderRadius={10}
      bg="lightGrey"
      alignItems="center"
      justifyContent="center"
    >
      {type === 'strong' ? (
        <LexiqueIcon color={config.color} size={18} />
      ) : (
        <FeatherIcon name={config.name} size={18} color={config.color} />
      )}
    </Box>
  )
}

const VerseTargetDescription = ({
  endpoint,
}: {
  endpoint: Extract<RelationEndpoint, { type: 'verse' }>
}) => {
  const verses = useBibleVerses(getVerseIds(endpoint))
  const description = verses.map(verse => verse.Texte).join(' ')

  if (!description) return null

  return (
    <Text fontSize={13} color="tertiary" numberOfLines={1}>
      {removeBreakLines(description)}
    </Text>
  )
}

const RelationTargetRow = ({
  item,
  onPress,
}: {
  item: MatchedRelationTargetResult
  onPress: () => void
}) => {
  const description = item.description || item.subtitle
  const titleMatch = getMatchForKey(item, 'title')
  const descriptionMatch = getMatchForKey(item, 'description')
  const subtitleMatch = getMatchForKey(item, 'subtitle')
  const descriptionRanges = descriptionMatch?.indices || subtitleMatch?.indices

  return (
    <TouchableBox
      px={20}
      py={14}
      borderBottomWidth={1}
      borderColor="border"
      onPress={onPress}
      row
      alignItems="center"
      gap={12}
    >
      <TargetIcon type={item.type} />
      <VStack flex={1} gap={3}>
        <HighlightedText value={item.title} ranges={titleMatch?.indices} bold />
        {item.endpoint.type === 'verse' ? (
          <VerseTargetDescription endpoint={item.endpoint} />
        ) : description ? (
          <HighlightedText value={description} ranges={descriptionRanges} />
        ) : null}
      </VStack>
      <FeatherIcon name="arrow-right" size={20} color="grey" />
    </TouchableBox>
  )
}

const StrongTargetRow = ({ item, onPress }: { item: LexiqueRow; onPress: () => void }) => (
  <TouchableBox
    px={20}
    py={14}
    borderBottomWidth={1}
    borderColor="border"
    onPress={onPress}
    row
    alignItems="center"
    gap={12}
  >
    <TargetIcon type="strong" />
    <VStack flex={1} gap={3}>
      <Text bold numberOfLines={1}>
        {item.Mot}
      </Text>
      <Text fontSize={13} color="tertiary" numberOfLines={1}>
        {getStrongSubtitle(item)}
      </Text>
    </VStack>
    <Text fontSize={16} color="tertiary">
      {getStrongOriginalWord(item)}
    </Text>
    <FeatherIcon name="arrow-right" size={20} color="grey" />
  </TouchableBox>
)

const LoadingIndicator = () => {
  const theme = useTheme()
  return (
    <Box flex minHeight={180} justifyContent="center" alignItems="center">
      <ActivityIndicator color={theme.colors.grey} />
    </Box>
  )
}

const CreateEntityRelationModal = ({
  ref,
  title,
  sourceEndpoint,
  onCreated,
  allowedTypes,
}: Props) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const [searchValue, setSearchValue] = useState('')
  const [browseMode, setBrowseMode] = useState<BrowseMode | null>(null)
  const [strongLetter, setStrongLetter] = useState('a')
  const [strongResults, setStrongResults] = useState<LexiqueRow[]>([])
  const [isStrongLoading, setIsStrongLoading] = useState(false)
  const [strongError, setStrongError] = useState<string | null>(null)
  const debouncedStrongSearchValue = useDebounce(searchValue, 300)
  const deferredSearchValue = useDeferredValue(searchValue)
  const deferredStrongSearchValue = useDeferredValue(debouncedStrongSearchValue)
  const deferredBrowseMode = useDeferredValue(browseMode)
  const immediateSearchHasValue = Boolean(searchValue.trim())
  const deferredSearchHasValue = Boolean(deferredSearchValue.trim())
  const isStrongPending =
    browseMode === 'strong' &&
    immediateSearchHasValue &&
    debouncedStrongSearchValue !== deferredStrongSearchValue
  const isLocalSearchPending =
    browseMode !== 'strong' && immediateSearchHasValue && searchValue !== deferredSearchValue

  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const shouldBuildNoteTargets =
    deferredBrowseMode === 'note' || (!deferredBrowseMode && deferredSearchHasValue)
  const shouldBuildStudyTargets =
    deferredBrowseMode === 'study' || (!deferredBrowseMode && deferredSearchHasValue)
  const noteTargets = shouldBuildNoteTargets
    ? getNoteTargetItems(notes).sort((a, b) => {
        const left = notes[(a.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
        const right = notes[(b.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
        return Number(right?.date || 0) - Number(left?.date || 0)
      })
    : []
  const studyTargets = shouldBuildStudyTargets
    ? getStudyTargetItems(studies).sort((a, b) => {
        const left = studies[(a.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
        const right = studies[(b.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
        return Number(right?.modified_at || 0) - Number(left?.modified_at || 0)
      })
    : []
  const fuzzyNoteTargets = searchWithMatches(noteTargets, deferredSearchValue)
  const fuzzyStudyTargets = searchWithMatches(studyTargets, deferredSearchValue)

  useEffect(() => {
    if (deferredBrowseMode !== 'strong') return

    let isMounted = true
    setIsStrongLoading(true)
    setStrongError(null)

    const loader = deferredStrongSearchValue.trim()
      ? loadLexiqueBySearch(deferredStrongSearchValue)
      : loadLexiqueByLetter(strongLetter)

    loader.then(results => {
      if (!isMounted) return
      if (isDatabaseError(results)) {
        setStrongResults([])
        setStrongError(results.error)
      } else {
        setStrongResults(results)
      }
      setIsStrongLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [deferredBrowseMode, deferredStrongSearchValue, strongLetter])

  const handleSearch = (value: string) => {
    setSearchValue(value)
  }

  const enterBrowseMode = (mode: BrowseMode) => {
    setBrowseMode(mode)
    handleSearch('')
  }

  const exitBrowseMode = () => {
    setBrowseMode(null)
    handleSearch('')
  }

  const selectTarget = (endpoint: RelationEndpoint) => {
    if (!sourceEndpoint) return

    dispatch(
      createStudyRelation({
        endpoints: [sourceEndpoint, endpoint],
      })
    )
    handleSearch('')
    setBrowseMode(null)
    onCreated?.()
  }

  const isAllowed = (type: RelationEndpoint['type']) =>
    allowedTypes ? allowedTypes.includes(type) : true

  const immediateReferenceResults = searchReferenceAndStrongTargets(searchValue)
  const unifiedResults = [
    ...immediateReferenceResults,
    ...(deferredSearchHasValue ? fuzzyNoteTargets.slice(0, 12) : []),
    ...(deferredSearchHasValue ? fuzzyStudyTargets.slice(0, 12) : []),
  ].filter(result => isAllowed(result.type))

  const browseResults =
    deferredBrowseMode === 'note'
      ? fuzzyNoteTargets
      : deferredBrowseMode === 'study'
        ? fuzzyStudyTargets
        : []

  const placeholder = browseMode
    ? {
        note: t('Rechercher dans les notes'),
        study: t('Rechercher dans les études'),
        strong: t('Rechercher un code Strong'),
      }[browseMode]
    : t('Jean 3:16, G26, note, étude...')

  const modalTitle: string = browseMode
    ? t(browseModeLabelKeys[browseMode])
    : title || t('Ajouter une relation')
  const modalSubtitle = getSourceEndpointSubtitle(sourceEndpoint, t)

  const renderTargetItem = ({ item }: { item: RelationTargetResult }) => (
    <RelationTargetRow item={item} onPress={() => selectTarget(item.endpoint)} />
  )

  const renderStrongItem = ({ item }: { item: LexiqueRow }) => (
    <StrongTargetRow item={item} onPress={() => selectTarget(getStrongEndpoint(item))} />
  )

  const emptyMessage = browseMode
    ? t('Aucun élément trouvé dans {{target}}', {
        target: t(browseModeLabelKeys[browseMode]).toLowerCase(),
      })
    : immediateSearchHasValue
      ? t('Aucune cible trouvée')
      : t('Rechercher un passage, un Strong, une note ou une étude')

  const emptyIcon = browseMode
    ? {
        note: require('~assets/images/empty-state-icons/note.svg'),
        study: require('~assets/images/empty-state-icons/study.svg'),
        strong: require('~assets/images/empty-state-icons/word.svg'),
      }[browseMode]
    : require('~assets/images/empty-state-icons/search.svg')

  const renderEmptyState = (message = emptyMessage) => (
    <Box flex minHeight={260} justifyContent="center" px={20}>
      <Empty icon={emptyIcon} message={message} />
    </Box>
  )
  const renderLoadingState = () => <LoadingIndicator />

  const headerComponent = (
    <Box px={20} pt={8} pb={12}>
      <BottomSheetSearchInput
        value={searchValue}
        onChangeText={handleSearch}
        onDelete={() => handleSearch('')}
        placeholder={placeholder}
        autoFocus
      />

      {!browseMode && (
        <HStack mt={10} gap={8}>
          {isAllowed('note') && (
            <TouchableBox
              onPress={() => enterBrowseMode('note')}
              px={10}
              py={8}
              bg="lightGrey"
              borderRadius={8}
            >
              <Text fontSize={13}>{t('Notes')}</Text>
            </TouchableBox>
          )}
          {isAllowed('study') && (
            <TouchableBox
              onPress={() => enterBrowseMode('study')}
              px={10}
              py={8}
              bg="lightGrey"
              borderRadius={8}
            >
              <Text fontSize={13}>{t('Études')}</Text>
            </TouchableBox>
          )}
          {isAllowed('strong') && (
            <TouchableBox
              onPress={() => enterBrowseMode('strong')}
              px={10}
              py={8}
              bg="lightGrey"
              borderRadius={8}
            >
              <Text fontSize={13}>{t('Strong')}</Text>
            </TouchableBox>
          )}
        </HStack>
      )}
    </Box>
  )

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['75%']}
      headerComponent={
        <>
          <ModalHeader
            title={modalTitle}
            subTitle={modalSubtitle}
            hasBackButton={Boolean(browseMode)}
            onBackPress={exitBrowseMode}
          />
          {headerComponent}
        </>
      }
      enableContentWrapper={false}
    >
      {browseMode === 'strong' ? (
        <VStack flex={1}>
          {strongError ? (
            <Box px={20} py={24}>
              <Text color="grey">{t('Impossible de charger le lexique Strong.')}</Text>
            </Box>
          ) : (
            <BottomSheetFlashList
              data={strongResults}
              renderItem={renderStrongItem}
              keyExtractor={(item: LexiqueRow) => `${item.lexiqueType}-${item.Code}-${item.Mot}`}
              estimatedItemSize={72}
              ListEmptyComponent={
                isStrongLoading || isStrongPending ? renderLoadingState() : renderEmptyState()
              }
            />
          )}
          {!deferredSearchHasValue && (
            <AlphabetList letter={strongLetter} setLetter={setStrongLetter} />
          )}
        </VStack>
      ) : (
        <BottomSheetFlashList
          data={browseMode ? browseResults : unifiedResults}
          renderItem={renderTargetItem}
          keyExtractor={(item: RelationTargetResult) => item.id}
          estimatedItemSize={72}
          ListEmptyComponent={isLocalSearchPending ? renderLoadingState() : renderEmptyState()}
        />
      )}
    </Modal.Body>
  )
}

export default CreateEntityRelationModal
