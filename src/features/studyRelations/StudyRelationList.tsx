import styled from '@emotion/native'
import { SheetFooter, Sheet, SheetTextInput, type SheetRef } from '~common/sheet'
import { MenuView } from '@expo/ui/community/menu'
import { type ComponentProps, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Empty from '~common/Empty'
import LexiqueIcon from '~common/LexiqueIcon'
import ModalHeader from '~common/ModalHeader'
import NaveIcon from '~common/NaveIcon'
import { ActionSheetItem } from '~common/ActionMenu'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
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

const directionalTypes: RelationType[] = ['references', 'explains', 'mentions']

const relationTypeChoices: { value: RelationType }[] = [
  { value: 'linked' },
  { value: 'references' },
  { value: 'explains' },
  { value: 'contrasts' },
  { value: 'mentions' },
]

const relationTypeCycle = relationTypeChoices.map(choice => choice.value)

const targetIconConfig: Record<
  RelationEndpoint['type'],
  {
    name?: ComponentProps<typeof FeatherIcon>['name']
    color: string
  }
> = {
  verse: { name: 'book-open', color: 'color1' },
  note: { name: 'file-text', color: 'color2' },
  study: { name: 'feather', color: 'tertiary' },
  strong: { name: 'hash', color: 'primary' },
  nave: { name: 'layers', color: 'quint' },
  dictionary: { name: 'book', color: 'secondary' },
  externalLink: { name: 'link', color: 'secondary' },
  word: { name: 'type', color: 'tertiary' },
}

const LabelInput = styled(SheetTextInput)(({ theme }) => ({
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

  switch (type) {
    case 'strong':
      return <LexiqueIcon color={config.color} size={15} />
    case 'nave':
      return <NaveIcon color={config.color} size={15} />
    case 'dictionary':
      return <DictionnaryIcon color={config.color} size={15} />
    case 'externalLink':
    case 'word':
    default:
      return <FeatherIcon name={config.name!} size={15} color={config.color} />
  }
}

const MissingTargetWarningIcon = () => (
  <Box
    alignItems="center"
    justifyContent="center"
    mr={6}
    position="absolute"
    top={20}
    left={35}
    bg="reverse"
    borderRadius={100}
    p={4}
  >
    <FeatherIcon name="alert-triangle" size={12} color="secondary" />
  </Box>
)

const getRelationTitleParts = (
  model: RelationDisplayModel,
  relationTitlePrefixes: Record<string, string>,
  t: (key: string) => string
) => {
  if (model.relation.type === 'annotates') {
    return {
      prefix: model.targetEndpoint.type === 'verse' ? t('Sur') : t('Note'),
      target: model.targetLabel,
    }
  }

  const prefix = relationTitlePrefixes[model.relationText] || model.relationText
  const target = (() => {
    switch (model.targetEndpoint.type) {
      case 'note':
        return t('une note')
      case 'study':
        return t('une étude')
      case 'strong':
      case 'nave':
      case 'dictionary':
      case 'externalLink':
      case 'word':
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
    case 'nave':
    case 'dictionary':
    case 'externalLink':
    case 'word':
      return ''
    default:
      return model.subtitle
  }
}

const getEndpointLabel = (endpoint: RelationEndpoint) => getEndpointFallbackLabel(endpoint)

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
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const editModalRef = useRef<SheetRef>(null)
  const actionModalRef = useRef<SheetRef>(null)
  const [editingModel, setEditingModel] = useState<RelationDisplayModel | null>(null)
  const [actionModel, setActionModel] = useState<RelationDisplayModel | null>(null)
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
  const relationTitlePrefixes: Record<string, string> = {
    [t('studyRelations.type.linked')]: t('studyRelations.title.linked'),
    [t('studyRelations.type.references')]: t('studyRelations.title.references'),
    [t('studyRelations.type.explains')]: t('studyRelations.title.explains'),
    [t('studyRelations.type.contrasts')]: t('studyRelations.title.contrasts'),
    [t('studyRelations.type.mentions')]: t('studyRelations.title.mentions'),
    [t('studyRelations.type.annotates')]: t('studyRelations.title.annotates'),
    [t('studyRelations.type.externalLink')]: t('studyRelations.title.externalLink'),
    [t('studyRelations.type.referencedBy')]: t('studyRelations.title.referencedBy'),
    [t('studyRelations.type.explainedBy')]: t('studyRelations.title.explainedBy'),
    [t('studyRelations.type.mentionedBy')]: t('studyRelations.title.mentionedBy'),
  }

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

  const openActionModal = (model: RelationDisplayModel) => {
    setActionModel(model)
    actionModalRef.current?.present()
  }

  const closeActionModal = () => {
    actionModalRef.current?.dismiss()
    setActionModel(null)
  }

  const openEditFromActionModal = () => {
    if (!actionModel) return

    const model = actionModel
    closeActionModal()
    setTimeout(() => openEditModal(model), 300)
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
    closeActionModal()

    Alert.alert(t('Supprimer la relation'), t('Voulez-vous supprimer cette relation?'), [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Supprimer'),
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
    getRelationTitleParts(
      { ...model, relationText: getDraftRelationText(model) },
      relationTitlePrefixes,
      t
    ).target

  const openRelationTarget = (model: RelationDisplayModel) => {
    if (!model.isTargetAvailable) {
      toast.warning(t("Cette cible n'existe plus. Vous pouvez supprimer la relation."))
      return
    }

    onOpenEndpoint(model.targetEndpoint)
  }

  const renderRelation = (model: RelationDisplayModel, index: number, sectionLength: number) => {
    const relationTitle = getRelationTitleParts(model, relationTitlePrefixes, t)
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
        {!model.isTargetAvailable ? <MissingTargetWarningIcon /> : null}

        <TouchableBox
          flex
          row
          alignItems="center"
          paddingVertical={10}
          ml={60}
          pl={0}
          borderBottomWidth={1}
          borderColor="border"
          onPress={() => openRelationTarget(model)}
          opacity={!model.isTargetAvailable ? 0.5 : 1}
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
          <TouchableBox
            width={42}
            height={42}
            center
            onPress={event => {
              event.stopPropagation()
              openActionModal(model)
            }}
          >
            <FeatherIcon name="more-vertical" size={18} />
          </TouchableBox>
        </TouchableBox>
      </Box>
    )
  }

  const hasDirectionalType = isDirectionalType(draft.type)

  return (
    <VStack flex={1}>
      {relations.length === 0 ? (
        <Box minHeight={220}>
          <Empty
            iconElement={<FeatherIcon name="git-merge" size={64} color="primary" />}
            message={t('Aucune relation')}
          />
        </Box>
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

      <Sheet
        ref={editModalRef}
        header={
          <ModalHeader
            title={t('Modifier la relation')}
            rightComponent={
              editingModel ? (
                <MenuView
                  actions={[
                    {
                      id: 'delete',
                      title: t('Supprimer'),
                      image: 'trash',
                      attributes: { destructive: true },
                    },
                  ]}
                  onPressAction={({ nativeEvent }) => {
                    if (nativeEvent.event === 'delete') confirmDelete()
                  }}
                >
                  <Box row center height={54} width={54}>
                    <FeatherIcon name="more-vertical" size={18} />
                  </Box>
                </MenuView>
              ) : undefined
            }
          />
        }
        footer={props => (
          <SheetFooter bottomInset={insets.bottom} {...props}>
            <HStack px={20} gap={10} justifyContent="flex-end" bg="reverse">
              <Box h={54}>
                <Button reverse onPress={closeEditModal}>
                  {t('Annuler')}
                </Button>
              </Box>
              <Box h={54}>
                <Button onPress={saveEdit}>{t('Enregistrer')}</Button>
              </Box>
            </HStack>
          </SheetFooter>
        )}
      >
        {editingModel ? (
          <VStack p={20} gap={22}>
            <VStack gap={10}>
              <HStack alignItems="center" wrap>
                <Text bold numberOfLines={1} shrink={1} fontSize={14}>
                  {getEndpointLabel(editingModel.activeEndpoint)}
                </Text>
                <TouchableBox
                  ml={6}
                  mr={hasDirectionalType ? 0 : 6}
                  pl={10}
                  pr={hasDirectionalType ? 6 : 10}
                  py={6}
                  borderTopLeftRadius={16}
                  borderBottomLeftRadius={16}
                  borderBottomRightRadius={hasDirectionalType ? 0 : 16}
                  borderTopRightRadius={hasDirectionalType ? 0 : 16}
                  bg="lightGrey"
                  onPress={cycleDraftType}
                >
                  <Text bold fontSize={12} color="primary">
                    {getDraftRelationText(editingModel)}
                  </Text>
                </TouchableBox>
                {hasDirectionalType ? (
                  <TouchableBox
                    mr={6}
                    pl={4}
                    pr={6}
                    height={28}
                    borderTopRightRadius={16}
                    borderBottomRightRadius={16}
                    borderLeftWidth={1}
                    borderColor="reverse"
                    bg="lightGrey"
                    alignItems="center"
                    justifyContent="center"
                    onPress={toggleDirection}
                  >
                    <MaterialIcon name="swap-horiz" size={16} color="primary" />
                  </TouchableBox>
                ) : null}
                <Text bold fontSize={14}>
                  {editingModel.targetEndpoint.type === 'note' ||
                  editingModel.targetEndpoint.type === 'study'
                    ? `${t('une')} `
                    : ''}
                </Text>
                <Box mx={4}>
                  <TargetIcon type={editingModel.targetEndpoint.type} />
                </Box>
                <Text bold numberOfLines={1} shrink={1} fontSize={14}>
                  {editingModel.targetEndpoint.type === 'note'
                    ? t('note')
                    : editingModel.targetEndpoint.type === 'study'
                      ? t('étude')
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
                    {t('Libellé')}
                  </Text>
                  <LabelInput
                    value={draft.label}
                    onChangeText={label => setDraft(current => ({ ...current, label }))}
                    placeholder={t('Libellé court')}
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
                    {t('Ajouter un libellé')}
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
      </Sheet>
      <Sheet ref={actionModalRef} onDismiss={() => setActionModel(null)}>
        {actionModel?.relation.kind !== 'system' ? (
          <ActionSheetItem icon="edit-3" label={t('Modifier')} onPress={openEditFromActionModal} />
        ) : null}
        <ActionSheetItem
          icon="trash-2"
          label={t('Supprimer')}
          color="quart"
          onPress={() => confirmDelete(actionModel)}
        />
      </Sheet>
    </VStack>
  )
}

export default StudyRelationList
