import { BottomSheetFlashList, BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import AlphabetList from '~common/AlphabetList'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useDebounce from '~helpers/useDebounce'
import useFuzzy from '~helpers/useFuzzy'
import loadLexiqueByLetter, { type LexiqueRow } from '~helpers/loadLexiqueByLetter'
import loadLexiqueBySearch from '~helpers/loadLexiqueBySearch'
import { RootState } from '~redux/modules/reducer'
import type { RelationEndpoint } from './domain'
import {
  getNoteTargetItems,
  getStudyTargetItems,
  searchReferenceAndStrongTargets,
  type RelationTargetResult,
} from './targetSearch'

type BrowseMode = 'note' | 'study' | 'strong'

type Props = {
  ref?: Ref<BottomSheetModal | null>
  title?: string
  onSelect: (endpoint: RelationEndpoint) => void
  allowedTypes?: RelationEndpoint['type'][]
}

const typeLabels: Record<RelationEndpoint['type'], string> = {
  verse: 'Verset',
  note: 'Note',
  study: 'Étude',
  strong: 'Strong',
}

const browseModeLabels: Record<BrowseMode, string> = {
  note: 'Notes',
  study: 'Études',
  strong: 'Strong',
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
  const fuzzyOptions = {
    keys: [
      { name: 'title', weight: 0.75 },
      { name: 'subtitle', weight: 0.25 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
  }
  const { result: fuzzyNoteTargets, search: searchNotes } = useFuzzy<RelationTargetResult>(
    noteTargets,
    fuzzyOptions
  )
  const { result: fuzzyStudyTargets, search: searchStudies } = useFuzzy<RelationTargetResult>(
    studyTargets,
    fuzzyOptions
  )

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
    searchNotes(value)
    searchStudies(value)
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

  const renderTargetItem = ({ item }: { item: RelationTargetResult }) => (
    <TouchableBox
      px={20}
      py={14}
      borderBottomWidth={1}
      borderColor="border"
      onPress={() => selectTarget(item.endpoint)}
    >
      <HStack alignItems="center" justifyContent="space-between" gap={12}>
        <VStack flex={1} gap={4}>
          <Text bold>{item.title}</Text>
          {item.subtitle ? (
            <Text fontSize={13} color="grey">
              {item.subtitle}
            </Text>
          ) : null}
        </VStack>
        <Box bg="lightGrey" px={8} py={4} borderRadius={4}>
          <Text fontSize={12}>{typeLabels[item.type]}</Text>
        </Box>
      </HStack>
    </TouchableBox>
  )

  const renderStrongItem = ({ item }: { item: LexiqueRow }) => (
    <TouchableBox
      px={20}
      py={14}
      borderBottomWidth={1}
      borderColor="border"
      onPress={() => selectTarget(getStrongEndpoint(item))}
    >
      <HStack alignItems="center" justifyContent="space-between" gap={12}>
        <VStack flex={1} gap={4}>
          <Text bold>{item.Mot}</Text>
          <Text fontSize={13} color="grey">
            {getStrongSubtitle(item)}
          </Text>
        </VStack>
        <Text fontSize={16}>{'Grec' in item ? item.Grec : item.Hebreu}</Text>
      </HStack>
    </TouchableBox>
  )

  const emptyMessage = browseMode
    ? `Aucun élément trouvé dans ${browseModeLabels[browseMode].toLowerCase()}`
    : query.trim()
      ? 'Aucune cible trouvée'
      : 'Rechercher un passage, un Strong, une note ou une étude'

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['75%']}
      headerComponent={<ModalHeader title={title} />}
      enableScrollView={false}
    >
      <Box px={20} pt={8} pb={12}>
        <BottomSheetSearchInput
          value={query}
          onChangeText={handleSearch}
          onDelete={() => handleSearch('')}
          placeholder={placeholder}
          autoFocus
        />

        {browseMode ? (
          <HStack mt={10} alignItems="center" gap={10}>
            <TouchableBox onPress={exitBrowseMode} px={10} py={8} bg="lightGrey" borderRadius={8}>
              <Text fontSize={13}>← Recherche</Text>
            </TouchableBox>
            <Text bold>{browseModeLabels[browseMode]}</Text>
          </HStack>
        ) : (
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
                <Box px={20} py={24}>
                  <Text color="grey">{isStrongLoading ? 'Chargement...' : emptyMessage}</Text>
                </Box>
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
          ListEmptyComponent={
            <Box px={20} py={24}>
              <Text color="grey">{emptyMessage}</Text>
            </Box>
          }
        />
      )}
    </Modal.Body>
  )
}

export default StudyRelationTargetPickerModal
