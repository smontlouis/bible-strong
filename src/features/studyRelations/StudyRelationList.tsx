import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { type ComponentProps, useRef, useState } from 'react'
import { Alert } from 'react-native'
import styled from '@emotion/native'
import { useDispatch, useSelector } from 'react-redux'
import DropdownMenu from '~common/DropdownMenu'
import LexiqueIcon from '~common/LexiqueIcon'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
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
  { value: 'references', label: 'Renvoi' },
  { value: 'explains', label: 'Explique' },
  { value: 'contrasts', label: 'Contraste' },
]

const relationTypeLabels: Record<RelationType, string> = {
  linked: 'Lié',
  references: 'Renvoi',
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
  if (type === 'strong') {
    return <LexiqueIcon color={config.color} size={15} />
  }

  return <FeatherIcon name={config.name} size={15} color={config.color} />
}

const relationTitlePrefixes: Record<string, string> = {
  'lié à': 'est lié à',
  'renvoie vers': 'renvoie vers',
  explique: 'explique',
  'contraste avec': 'contraste avec',
  'référencé par': 'est référencé par',
  'expliqué par': 'est expliqué par',
}

const getRelationTitleParts = (model: RelationDisplayModel) => {
  const prefix = relationTitlePrefixes[model.relationText] || model.relationText
  const target = (() => {
    switch (model.targetEndpoint.type) {
      case 'note':
        return 'une note'
      case 'study':
        return 'une étude'
      case 'strong':
        return model.targetLabel
      default:
        return model.targetLabel
    }
  })()

  return { prefix, target }
}

const getRelationSubtitle = (model: RelationDisplayModel) => {
  switch (model.targetEndpoint.type) {
    case 'note':
    case 'study':
      return model.targetLabel
    case 'verse':
    case 'strong':
      return ''
    default:
      return model.subtitle
  }
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

  const confirmDelete = (model = editingModel) => {
    if (!model) return

    Alert.alert('Supprimer la relation', 'Voulez-vous supprimer cette relation?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          dispatch(deleteStudyRelation(model.relation.id))
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
        relations.map((model, index) => {
          const relationTitle = getRelationTitleParts(model)
          const relationSubtitle = getRelationSubtitle(model)
          return (
            <Box key={model.relation.id}>
              <Box
                pos="absolute"
                top={0}
                left={10}
                borderLeftWidth={4}
                borderBottomWidth={4}
                borderBottomLeftRadius={50}
                height={35}
                width={25}
                borderColor="border"
              />
              {index !== relations.length - 1 && (
                <Box
                  pos="absolute"
                  top={0}
                  bottom={0}
                  left={10}
                  borderLeftWidth={4}
                  width={25}
                  borderColor="border"
                />
              )}
              <TouchableBox
                flex
                row
                alignItems="center"
                paddingVertical={14}
                ml={40}
                pl={10}
                borderBottomWidth={1}
                borderColor="border"
                onPress={() => onOpenEndpoint(model.targetEndpoint)}
              >
                <Box flex>
                  <HStack alignItems="center">
                    <Text bold numberOfLines={1}>
                      {relationTitle.prefix}
                    </Text>
                    <Box mx={6}>
                      <TargetIcon type={model.targetEndpoint.type} />
                    </Box>
                    <Text bold numberOfLines={1} shrink={1}>
                      {relationTitle.target}
                    </Text>
                  </HStack>
                  {relationSubtitle ? (
                    <Text fontSize={13} color="tertiary" numberOfLines={1}>
                      {relationSubtitle}
                    </Text>
                  ) : null}
                  {model.relation.label ? (
                    <Text fontSize={13} color="tertiary" numberOfLines={1}>
                      {model.relation.label}
                    </Text>
                  ) : null}
                </Box>
                <PopOverMenu
                  width={42}
                  height={42}
                  popover={
                    <>
                      <MenuOption onSelect={() => openEditModal(model)} closeBeforeSelect>
                        <HStack alignItems="center">
                          <FeatherIcon name="edit-3" size={15} />
                          <Text ml={10}>Modifier</Text>
                        </HStack>
                      </MenuOption>
                      <MenuOption onSelect={() => confirmDelete(model)}>
                        <HStack alignItems="center">
                          <FeatherIcon name="trash-2" size={15} color="quart" />
                          <Text ml={10} color="quart">
                            Supprimer
                          </Text>
                        </HStack>
                      </MenuOption>
                    </>
                  }
                />
              </TouchableBox>
            </Box>
          )
        })
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

            <TouchableBox onPress={() => confirmDelete()} py={6}>
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
