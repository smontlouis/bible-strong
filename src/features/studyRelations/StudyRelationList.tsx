import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { type ComponentProps, useRef, useState } from 'react'
import { Alert, TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import { useDispatch, useSelector } from 'react-redux'
import DropdownMenu from '~common/DropdownMenu'
import LexiqueIcon from '~common/LexiqueIcon'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { RootState } from '~redux/modules/reducer'
import {
  deleteStudyRelation,
  type RelationDirection,
  type RelationEndpoint,
  type RelationType,
  updateStudyRelation,
} from '~redux/modules/user'
import { makeStudyRelationDisplayModelsSelector } from '~redux/selectors/bible'
import type { RelationDisplayModel } from './domain'

type Props = {
  endpoint: RelationEndpoint
  onOpenEndpoint: (endpoint: RelationEndpoint) => void
  onCreateRelation?: () => void
  showCreateButton?: boolean
  showEmptyState?: boolean
}

type RelationDraft = {
  label: string
  type: RelationType
  direction: RelationDirection
}

const selectDisplayModels = makeStudyRelationDisplayModelsSelector()

const directionalTypes: RelationType[] = ['references', 'explains']

const relationTypeChoices: { value: RelationType; label: string; subLabel?: string }[] = [
  { value: 'linked', label: 'Lié' },
  { value: 'references', label: 'Référence' },
  { value: 'explains', label: 'Explique' },
  { value: 'contrasts', label: 'Contraste' },
]

const relationTypeLabels: Record<RelationType, string> = {
  linked: 'Lié',
  references: 'Référence',
  explains: 'Explique',
  contrasts: 'Contraste',
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

const ItemRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  paddingHorizontal: 0,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const IconContainer = styled.View(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
}))

const LabelInput = styled(BottomSheetTextInput)(({ theme }) => ({
  minHeight: 44,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: 12,
  paddingHorizontal: 12,
  color: theme.colors.default,
  backgroundColor: theme.colors.lightGrey,
}))

const TargetIcon = ({ type }: { type: RelationEndpoint['type'] }) => {
  const config = targetIconConfig[type]
  return (
    <IconContainer>
      {type === 'strong' ? (
        <LexiqueIcon color={config.color} size={18} />
      ) : (
        <FeatherIcon name={config.name} size={18} color={config.color} />
      )}
    </IconContainer>
  )
}

const relationTitlePrefixes: Record<string, string> = {
  'lié à': 'est lié à',
  référence: 'référence',
  explique: 'explique',
  'contraste avec': 'contraste avec',
  'référencé par': 'est référencé par',
  'expliqué par': 'est expliqué par',
}

const getRelationTitle = (model: RelationDisplayModel) => {
  const prefix = relationTitlePrefixes[model.relationText] || model.relationText
  return `${prefix} ${model.targetLabel}`
}

const isDirectionalType = (type: RelationType) => directionalTypes.includes(type)

const normalizeDirection = (
  type: RelationType,
  direction: RelationDirection
): RelationDirection => {
  if (!isDirectionalType(type)) return 'none'
  return direction === 'none' ? 'forward' : direction
}

const StudyRelationList = ({
  endpoint,
  onOpenEndpoint,
  onCreateRelation,
  showCreateButton = true,
  showEmptyState = false,
}: Props) => {
  const dispatch = useDispatch()
  const editModalRef = useRef<BottomSheetModal>(null)
  const [editingModel, setEditingModel] = useState<RelationDisplayModel | null>(null)
  const [draft, setDraft] = useState<RelationDraft>({
    label: '',
    type: 'linked',
    direction: 'none',
  })
  const relations = useSelector((state: RootState) => selectDisplayModels(state, endpoint))

  if (relations.length === 0 && !onCreateRelation && !showEmptyState) return null

  const openEditModal = (model: RelationDisplayModel) => {
    setEditingModel(model)
    setDraft({
      label: model.relation.label || '',
      type: model.relation.type,
      direction: model.relation.direction,
    })
    editModalRef.current?.present()
  }

  const setDraftType = (type: RelationType) => {
    setDraft(current => ({
      ...current,
      type,
      direction: normalizeDirection(type, current.direction),
    }))
  }

  const toggleDirection = () => {
    setDraft(current => ({
      ...current,
      direction: current.direction === 'forward' ? 'backward' : 'forward',
    }))
  }

  const closeEditModal = () => {
    editModalRef.current?.dismiss()
    setEditingModel(null)
  }

  const saveEdit = () => {
    if (!editingModel) return

    dispatch(
      updateStudyRelation({
        id: editingModel.relation.id,
        changes: {
          label: draft.label,
          type: draft.type,
          direction: normalizeDirection(draft.type, draft.direction),
        },
      })
    )
    closeEditModal()
  }

  const confirmDelete = () => {
    if (!editingModel) return

    Alert.alert('Supprimer la relation', 'Voulez-vous supprimer cette relation?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          dispatch(deleteStudyRelation(editingModel.relation.id))
          closeEditModal()
        },
      },
    ])
  }

  return (
    <VStack>
      {showCreateButton && onCreateRelation ? (
        <HStack alignItems="center" justifyContent="flex-end" px={0} mb={4}>
          <Button small onPress={onCreateRelation}>
            Ajouter
          </Button>
        </HStack>
      ) : null}

      {relations.length === 0 ? (
        <Text color="grey">Aucune relation</Text>
      ) : (
        relations.map(model => (
          <ItemRow key={model.relation.id}>
            <TargetIcon type={model.targetEndpoint.type} />
            <Box flex>
              <TouchableBox onPress={() => onOpenEndpoint(model.targetEndpoint)} py={2}>
                <Text bold numberOfLines={1}>
                  {getRelationTitle(model)}
                </Text>
              </TouchableBox>
              <Text fontSize={13} color="tertiary" numberOfLines={1}>
                {model.subtitle}
              </Text>
              {model.relation.label ? (
                <Text fontSize={13} color="tertiary" numberOfLines={1}>
                  {model.relation.label}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={() => {
                  openEditModal(model)
                }}
              >
                <HStack mt={8} alignItems="center">
                  <FeatherIcon name="edit-3" size={11} color="tertiary" />
                  <Text fontSize={11} color="tertiary" ml={4}>
                    Modifier
                  </Text>
                </HStack>
              </TouchableOpacity>
            </Box>
            <TouchableBox onPress={() => onOpenEndpoint(model.targetEndpoint)} p={8} ml={8}>
              <FeatherIcon name="arrow-right" size={18} color="grey" />
            </TouchableBox>
          </ItemRow>
        ))
      )}

      <Modal.Body
        ref={editModalRef}
        enableDynamicSizing
        enableScrollView={false}
        headerComponent={<ModalHeader title="Modifier la relation" />}
      >
        {editingModel ? (
          <VStack p={20} gap={18}>
            <VStack gap={8}>
              <Text fontSize={13} color="tertiary">
                Libellé
              </Text>
              <LabelInput
                value={draft.label}
                onChangeText={label => setDraft(current => ({ ...current, label }))}
                placeholder="Libellé court"
                maxLength={80}
                returnKeyType="done"
              />
            </VStack>

            <DropdownMenu
              title="Type"
              currentValue={draft.type}
              setValue={setDraftType}
              choices={relationTypeChoices}
              customRender={
                <TouchableBox py={8}>
                  <Text fontSize={13} color="tertiary">
                    Type
                  </Text>
                  <HStack mt={8} alignItems="center" justifyContent="space-between">
                    <Text bold>{relationTypeLabels[draft.type]}</Text>
                    <FeatherIcon name="chevron-down" size={18} color="grey" />
                  </HStack>
                </TouchableBox>
              }
            />

            {isDirectionalType(draft.type) ? (
              <VStack gap={8}>
                <Text fontSize={13} color="tertiary">
                  Direction
                </Text>
                <TouchableBox
                  onPress={toggleDirection}
                  width={48}
                  height={40}
                  borderRadius={12}
                  bg="lightGrey"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FeatherIcon
                    name={draft.direction === 'backward' ? 'arrow-left' : 'arrow-right'}
                    size={20}
                    color="primary"
                  />
                </TouchableBox>
              </VStack>
            ) : null}

            <HStack gap={10}>
              <Button small onPress={saveEdit}>
                Enregistrer
              </Button>
              <Button small secondary onPress={closeEditModal}>
                Annuler
              </Button>
            </HStack>

            <TouchableBox onPress={confirmDelete} py={6}>
              <Text bold color="quart">
                Supprimer
              </Text>
            </TouchableBox>
          </VStack>
        ) : null}
      </Modal.Body>
    </VStack>
  )
}

export default StudyRelationList
