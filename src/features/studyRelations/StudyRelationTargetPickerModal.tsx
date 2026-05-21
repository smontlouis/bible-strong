import { BottomSheetFlashList, BottomSheetModal } from '@gorhom/bottom-sheet'
import Fuse from 'fuse.js'
import { ComponentProps, Ref, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
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
import type { RelationEndpoint } from './domain'
import {
  getNoteTargetItems,
  getStudyTargetItems,
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from './targetSearch'

type BrowseMode = 'note' | 'study' | 'strong'
type MatchRange = readonly [number, number]
type MatchedRelationTargetResult = RelationTargetResult & {
  matches?: readonly Fuse.FuseResultMatch[]
}

type Props = {
  ref?: Ref<BottomSheetModal | null>
  title?: string
  onSelect: (endpoint: RelationEndpoint) => void
  allowedTypes?: RelationEndpoint['type'][]
}

const browseModeLabels: Record<BrowseMode, string> = {
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

const getStrongEndpoint = (strong: LexiqueRow): RelationEndpoint => ({
  type: 'strong',
  language: strong.lexiqueType === 'Grec' ? 'greek' : 'hebrew',
  code: strong.Code,
  label: strong.Mot,
  originalWord: 'Grec' in strong ? strong.Grec : strong.Hebreu,
})

const getStrongSubtitle = (strong: LexiqueRow) =>
  `${strong.lexiqueType} · ${strong.lexiqueType === 'Grec' ? 'G' : 'H'}${strong.Code}`

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
    { name: 'title', weight: 0.6 },
    { name: 'description', weight: 0.35 },
    { name: 'subtitle', weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  ignoreFieldNorm: true,
  includeMatches: true,
  findAllMatches: true,
  minMatchCharLength: 2,
  getFn: getFuzzyValue,
}

const searchWithMatches = (
  targets: RelationTargetResult[],
  keyword: string
): MatchedRelationTargetResult[] => {
  const trimmed = keyword.trim()
  if (!trimmed) return targets

  return new Fuse(targets, fuzzyOptions).search(removeAccents(trimmed)).map(result => ({
    ...result.item,
    matches: result.matches,
  }))
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

const getExcerpt = (value: string, ranges: readonly MatchRange[], context = 26) => {
  const firstRange = ranges[0]
  if (!firstRange || value.length <= 90) {
    return {
      text: removeBreakLines(value),
      ranges,
    }
  }

  const start = Math.max(0, firstRange[0] - context)
  const end = Math.min(value.length, firstRange[1] + context)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < value.length ? '...' : ''
  const text = `${prefix}${value.slice(start, end)}${suffix}`
  const offset = start - prefix.length

  return {
    text: removeBreakLines(text),
    ranges: ranges
      .map(([rangeStart, rangeEnd]) => [
        Math.max(0, rangeStart - offset),
        Math.min(text.length - 1, rangeEnd - offset),
      ])
      .filter(([rangeStart, rangeEnd]) => rangeEnd >= 0 && rangeStart < text.length),
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
  const mergedRanges = ranges ? mergeRanges(ranges) : []

  if (!mergedRanges.length) {
    return (
      <Text
        bold={bold}
        fontSize={bold ? 16 : 13}
        color={bold ? undefined : color}
        numberOfLines={1}
      >
        {removeBreakLines(value)}
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
      <FeatherIcon name="plus" size={20} color="grey" />
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
      {'Grec' in item ? item.Grec : item.Hebreu}
    </Text>
    <FeatherIcon name="plus" size={20} color="grey" />
  </TouchableBox>
)

const StudyRelationTargetPickerModal = ({
  ref,
  title = 'Ajouter une relation',
  onSelect,
  allowedTypes,
}: Props) => {
  const [query, setQuery] = useState('')
  const [browseMode, setBrowseMode] = useState<BrowseMode | null>(null)
  const [strongLetter, setStrongLetter] = useState('a')
  const [strongResults, setStrongResults] = useState<LexiqueRow[]>([])
  const [isStrongLoading, setIsStrongLoading] = useState(false)
  const [strongError, setStrongError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)

  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const noteTargets = getNoteTargetItems(notes).sort((a, b) => {
    const left = notes[(a.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
    const right = notes[(b.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
    return Number(right?.date || 0) - Number(left?.date || 0)
  })
  const studyTargets = getStudyTargetItems(studies).sort((a, b) => {
    const left = studies[(a.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
    const right = studies[(b.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
    return Number(right?.modified_at || 0) - Number(left?.modified_at || 0)
  })
  const fuzzyNoteTargets = searchWithMatches(noteTargets, query)
  const fuzzyStudyTargets = searchWithMatches(studyTargets, query)

  useEffect(() => {
    if (browseMode !== 'strong') return

    let isMounted = true
    setIsStrongLoading(true)
    setStrongError(null)

    const loader = debouncedQuery.trim()
      ? loadLexiqueBySearch(debouncedQuery)
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
  }, [browseMode, debouncedQuery, strongLetter])

  const handleSearch = (value: string) => {
    setQuery(value)
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
    onSelect(endpoint)
    handleSearch('')
    setBrowseMode(null)
  }

  const isAllowed = (type: RelationEndpoint['type']) =>
    allowedTypes ? allowedTypes.includes(type) : true

  const unifiedResults = [
    ...searchReferenceAndStrongTargets(query),
    ...(query.trim() ? fuzzyNoteTargets.slice(0, 12) : []),
    ...(query.trim() ? fuzzyStudyTargets.slice(0, 12) : []),
  ].filter(result => isAllowed(result.type))

  const browseResults =
    browseMode === 'note' ? fuzzyNoteTargets : browseMode === 'study' ? fuzzyStudyTargets : []

  const placeholder = browseMode
    ? {
        note: 'Rechercher dans les notes',
        study: 'Rechercher dans les études',
        strong: 'Rechercher un code Strong',
      }[browseMode]
    : 'Jean 3:16, G26, note, étude...'

  const modalTitle = browseMode ? browseModeLabels[browseMode] : title

  const renderTargetItem = ({ item }: { item: RelationTargetResult }) => (
    <RelationTargetRow item={item} onPress={() => selectTarget(item.endpoint)} />
  )

  const renderStrongItem = ({ item }: { item: LexiqueRow }) => (
    <StrongTargetRow item={item} onPress={() => selectTarget(getStrongEndpoint(item))} />
  )

  const emptyMessage = browseMode
    ? `Aucun élément trouvé dans ${browseModeLabels[browseMode].toLowerCase()}`
    : query.trim()
      ? 'Aucune cible trouvée'
      : 'Rechercher un passage, un Strong, une note ou une étude'

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

  const headerComponent = (
    <Box px={20} pt={8} pb={12}>
      <BottomSheetSearchInput
        value={query}
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
              <Text fontSize={13}>Notes</Text>
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
              <Text fontSize={13}>Études</Text>
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
              <Text fontSize={13}>Strong</Text>
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
              <Text color="grey">Impossible de charger le lexique Strong.</Text>
            </Box>
          ) : (
            <BottomSheetFlashList
              data={strongResults}
              renderItem={renderStrongItem}
              keyExtractor={(item: LexiqueRow) => `${item.lexiqueType}-${item.Code}-${item.Mot}`}
              estimatedItemSize={72}
              ListEmptyComponent={
                isStrongLoading
                  ? renderEmptyState('Chargement du lexique Strong...')
                  : renderEmptyState()
              }
            />
          )}
          {!query.trim() && <AlphabetList letter={strongLetter} setLetter={setStrongLetter} />}
        </VStack>
      ) : (
        <BottomSheetFlashList
          data={browseMode ? browseResults : unifiedResults}
          renderItem={renderTargetItem}
          keyExtractor={(item: RelationTargetResult) => item.id}
          estimatedItemSize={72}
          ListEmptyComponent={renderEmptyState()}
        />
      )}
    </Modal.Body>
  )
}

export default StudyRelationTargetPickerModal
