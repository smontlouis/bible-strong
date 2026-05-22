import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { type ComponentProps, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import styled from '@emotion/native'
import { useDispatch, useSelector } from 'react-redux'
import LexiqueIcon from '~common/LexiqueIcon'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
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
import {
  makeStudyRelationDisplayModelsSelector,
  makeStudyRelationDisplaySectionsForStartingVerseKeySelector,
} from '~redux/selectors/bible'
import { getEndpointFallbackLabel, getRelationText, type RelationDisplayModel } from './domain'

type Props = {
  endpoint: RelationEndpoint
  onOpenEndpoint: (endpoint: RelationEndpoint) => void
  showEmptyState?: boolean
  includeStartingVerseRelations?: boolean
}

type RelationDraft = {
  label: string
  type: RelationType
  direction: RelationDirection
}

const selectDisplayModels = makeStudyRelationDisplayModelsSelector()
const selectDisplaySectionsForStartingVerseKey =
  makeStudyRelationDisplaySectionsForStartingVerseKeySelector()

const directionalTypes: RelationType[] = ['references', 'explains']

const relationTypeChoices: { value: RelationType; label: string; subLabel?: string }[] = [
  { value: 'linked', label: 'Lié' },
  { value: 'references', label: 'Renvoi' },
  { value: 'explains', label: 'Explique' },
  { value: 'contrasts', label: 'Contraste' },
]

const relationTypeCycle = relationTypeChoices.map(choice => choice.value)

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

const getEndpointLabel = (endpoint: RelationEndpoint) =>
  endpoint.label || getEndpointFallbackLabel(endpoint)

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
  showEmptyState = false,
  includeStartingVerseRelations = false,
}: Props) => {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const editModalRef = useRef<BottomSheetModal>(null)
  const [editingModel, setEditingModel] = useState<RelationDisplayModel | null>(null)
  const [draft, setDraft] = useState<RelationDraft>({
    label: '',
    type: 'linked',
    direction: 'none',
  })
  const [isLabelExpanded, setIsLabelExpanded] = useState(false)
  const exactRelations = useSelector((state: RootState) => selectDisplayModels(state, endpoint))
  const startingVerseSections = useSelector((state: RootState) =>
    includeStartingVerseRelations && endpoint.type === 'verse' && endpoint.verseKeys.length === 1
      ? selectDisplaySectionsForStartingVerseKey(state, endpoint.verseKeys[0])
      : []
  )
  const sections = includeStartingVerseRelations
    ? startingVerseSections
    : [{ id: 'relations', title: '', data: exactRelations }]
  const relations = sections.flatMap(section => section.data)

  if (relations.length === 0 && !showEmptyState) return null

  const openEditModal = (model: RelationDisplayModel) => {
    setEditingModel(model)
    setDraft({
      label: model.relation.label || '',
      type: model.relation.type,
      direction: model.relation.direction,
    })
    setIsLabelExpanded(Boolean(model.relation.label))
    editModalRef.current?.present()
  }

  const cycleDraftType = () => {
    setDraft(current => {
      const currentIndex = relationTypeCycle.indexOf(current.type)
      const nextType = relationTypeCycle[(currentIndex + 1) % relationTypeCycle.length]

      return {
        ...current,
        type: nextType,
        direction: normalizeDirection(nextType, current.direction),
      }
    })
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

  const getDraftRelationText = (model: RelationDisplayModel) => {
    const relationText = getRelationText(
      {
        ...model.relation,
        type: draft.type,
        direction: normalizeDirection(draft.type, draft.direction),
      },
      model.activeEndpoint
    )

    return relationTitlePrefixes[relationText] || relationText
  }

  const getDraftTargetTitle = (model: RelationDisplayModel) =>
    getRelationTitleParts({ ...model, relationText: getDraftRelationText(model) }).target

  const renderRelation = (model: RelationDisplayModel, index: number, sectionLength: number) => {
    const relationTitle = getRelationTitleParts(model)
    const relationSubtitle = getRelationSubtitle(model)

    return (
      <Box key={model.relation.id}>
        <Box
          pos="absolute"
          top={0}
          left={20}
          borderLeftWidth={4}
          borderBottomWidth={4}
          borderBottomLeftRadius={50}
          height={35}
          width={25}
          borderColor="border"
        />
        {index !== sectionLength - 1 && (
          <Box
            pos="absolute"
            top={0}
            bottom={0}
            left={20}
            borderLeftWidth={4}
            width={25}
            borderColor="border"
          />
        )}
        <TouchableBox
          flex
          row
          alignItems="center"
          paddingVertical={10}
          ml={60}
          pl={0}
          borderBottomWidth={1}
          borderColor="border"
          onPress={() => onOpenEndpoint(model.targetEndpoint)}
        >
          <Box flex>
            <HStack alignItems="center">
              <Text bold numberOfLines={1} fontSize={14}>
                {relationTitle.prefix}
              </Text>
              <Box mx={6}>
                <TargetIcon type={model.targetEndpoint.type} />
              </Box>
              <Text bold numberOfLines={1} shrink={1} fontSize={14}>
                {relationTitle.target}
              </Text>
            </HStack>
            {relationSubtitle ? (
              <Text fontSize={12} color="tertiary" numberOfLines={1}>
                {relationSubtitle}
              </Text>
            ) : null}
            {model.relation.label ? (
              <Text fontSize={12} color="tertiary" numberOfLines={1}>
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
  }

  return (
    <VStack>
      {relations.length === 0 ? (
        <Text color="grey">Aucune relation</Text>
      ) : (
        sections.map(section => (
          <VStack key={section.id} mb={12}>
            {section.title ? (
              <HStack alignItems="center" ml={20} py={20}>
                <TargetIcon type="verse" />
                <Text bold color="tertiary" ml={8}>
                  {section.title}
                </Text>
              </HStack>
            ) : null}
            {section.data.map((model, index) => renderRelation(model, index, section.data.length))}
          </VStack>
        ))
      )}

      <Modal.Body
        ref={editModalRef}
        enableDynamicSizing
        enableScrollView={false}
        headerComponent={
          <ModalHeader
            title="Modifier la relation"
            rightComponent={
              editingModel ? (
                <PopOverMenu
                  width={54}
                  height={54}
                  popover={
                    <MenuOption onSelect={() => confirmDelete()}>
                      <HStack alignItems="center">
                        <FeatherIcon name="trash-2" size={15} color="quart" />
                        <Text ml={10} color="quart">
                          Supprimer
                        </Text>
                      </HStack>
                    </MenuOption>
                  }
                />
              ) : undefined
            }
          />
        }
        footerComponent={props => (
          <BottomSheetFooter bottomInset={insets.bottom} {...props}>
            <HStack px={20} gap={10} justifyContent="flex-end" bg="reverse">
              <Box h={54}>
                <Button reverse onPress={closeEditModal}>
                  Annuler
                </Button>
              </Box>
              <Box h={54}>
                <Button onPress={saveEdit}>Enregistrer</Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        )}
      >
        {editingModel ? (
          <VStack p={20} gap={22}>
            <VStack gap={10}>
              <HStack alignItems="center" wrap>
                <Text bold numberOfLines={1} shrink={1}>
                  {getEndpointLabel(editingModel.activeEndpoint)}
                </Text>
                <TouchableBox
                  mx={6}
                  px={10}
                  py={6}
                  borderRadius={16}
                  bg="lightGrey"
                  onPress={cycleDraftType}
                >
                  <Text bold fontSize={13} color="primary">
                    {getDraftRelationText(editingModel)}
                  </Text>
                </TouchableBox>
                {isDirectionalType(draft.type) ? (
                  <TouchableBox
                    mr={6}
                    width={26}
                    height={28}
                    borderRadius={16}
                    bg="lightGrey"
                    alignItems="center"
                    justifyContent="center"
                    onPress={toggleDirection}
                  >
                    <MaterialIcon name="swap-horiz" size={16} color="primary" />
                  </TouchableBox>
                ) : null}
                <Text bold>
                  {editingModel.targetEndpoint.type === 'note' ||
                  editingModel.targetEndpoint.type === 'study'
                    ? 'une '
                    : ''}
                </Text>
                <Box mx={4}>
                  <TargetIcon type={editingModel.targetEndpoint.type} />
                </Box>
                <Text bold numberOfLines={1} shrink={1}>
                  {editingModel.targetEndpoint.type === 'note'
                    ? 'note'
                    : editingModel.targetEndpoint.type === 'study'
                      ? 'étude'
                      : getDraftTargetTitle(editingModel)}
                </Text>
              </HStack>
              {getRelationSubtitle(editingModel) ? (
                <Text fontSize={13} color="tertiary" numberOfLines={1}>
                  {getRelationSubtitle(editingModel)}
                </Text>
              ) : null}
            </VStack>

            <VStack gap={8} mt="auto" alignItems="flex-end">
              {isLabelExpanded ? (
                <VStack gap={8} alignSelf="stretch">
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
              ) : (
                <TouchableBox
                  row
                  alignItems="center"
                  justifyContent="flex-end"
                  py={6}
                  onPress={() => setIsLabelExpanded(true)}
                >
                  <Text fontSize={12} color="tertiary">
                    Ajouter un libellé
                  </Text>
                  <FeatherIcon
                    name="chevron-down"
                    size={14}
                    color="tertiary"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableBox>
              )}
            </VStack>
          </VStack>
        ) : null}
      </Modal.Body>
    </VStack>
  )
}

export default StudyRelationList
