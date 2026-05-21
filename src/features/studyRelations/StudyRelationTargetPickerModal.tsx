import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { Ref, useState } from 'react'
import { useSelector } from 'react-redux'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import type { RelationEndpoint } from './domain'
import { searchRelationTargets } from './targetSearch'

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

const StudyRelationTargetPickerModal = ({
  ref,
  title = 'Ajouter une relation',
  onSelect,
  allowedTypes,
}: Props) => {
  const [query, setQuery] = useState('')
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const results = searchRelationTargets(query, { notes, studies }).filter(result =>
    allowedTypes ? allowedTypes.includes(result.type) : true
  )

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['75%']}
      headerComponent={<ModalHeader title={title} />}
      enableScrollView
    >
      <Box px={20} pb={10}>
        <BottomSheetSearchInput
          value={query}
          onChangeText={setQuery}
          onDelete={() => setQuery('')}
          placeholder="Jean 3:16, G26, note, étude..."
          autoFocus
        />
      </Box>

      {results.length === 0 ? (
        <Box px={20} py={24}>
          <Text color="grey">
            {query.trim()
              ? 'Aucune cible trouvée'
              : 'Rechercher un passage, un Strong, une note ou une étude'}
          </Text>
        </Box>
      ) : (
        <VStack>
          {results.map(result => (
            <TouchableBox
              key={result.id}
              px={20}
              py={14}
              borderBottomWidth={1}
              borderColor="border"
              onPress={() => {
                onSelect(result.endpoint)
                setQuery('')
              }}
            >
              <HStack alignItems="center" justifyContent="space-between" gap={12}>
                <VStack flex={1} gap={4}>
                  <Text bold>{result.title}</Text>
                  {result.subtitle ? (
                    <Text fontSize={13} color="grey">
                      {result.subtitle}
                    </Text>
                  ) : null}
                </VStack>
                <Box bg="lightGrey" px={8} py={4} borderRadius={4}>
                  <Text fontSize={12}>{typeLabels[result.type]}</Text>
                </Box>
              </HStack>
            </TouchableBox>
          ))}
        </VStack>
      )}
    </Modal.Body>
  )
}

export default StudyRelationTargetPickerModal
