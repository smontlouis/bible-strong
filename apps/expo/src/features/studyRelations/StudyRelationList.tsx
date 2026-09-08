import {
  type ComponentPropsWithRef as UIComponentProps,
  type ComponentProps,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import { useDispatch, useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Empty from '~common/Empty'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  type SheetRef,
  SheetTextInput,
  SheetView,
} from '~common/sheet'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import { type MenuAction, MenuView } from '~common/ui/MenuView'
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
import type { Theme as AppTheme } from '~themes'
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
  annotation: { name: 'edit-3', color: 'primary' },
  word: { name: 'type', color: 'tertiary' },
}

const LabelInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'min-h-[44px] border-[1px] border-border rounded-[12px] px-[12px] text-default bg-light-grey',
      className
    )
  )
  return (
    <SheetTextInput
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof SheetTextInput>['style']}
    />
  )
}

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
  <Box className="overflow-hidden border-continuous items-center justify-center mr-[6px] absolute top-[20px] left-[35px] bg-reverse rounded-[100px] p-[4px]">
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
  const confirm = useConfirmDialog()
  const editModalRef = useRef<SheetRef>(null)
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
      ? selectDisplaySectionsForStartingVerseKey(state, endpoint.verseKeys[0], endpoint.version)
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

  const openEditModal = (model: RelationDisplayModel, present = true) => {
    setEditingModel(model)
    setDraft({
      label: model.relation.label || '',
      type: model.relation.type,
      direction: model.relation.direction,
    })
    setIsLabelExpanded(Boolean(model.relation.label))
    if (present) editModalRef.current?.present()
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

  const confirmDelete = async (model = editingModel) => {
    if (!model) return
    if (
      await confirm({
        title: t('Supprimer la relation'),
        message: t('Voulez-vous supprimer cette relation?'),
        cancelLabel: t('Annuler'),
        confirmLabel: t('Supprimer'),
        destructive: true,
      })
    ) {
      dispatch(deleteStudyRelation(model.relation.id))
      closeEditModal()
    }
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

  const hasDirectionalType = isDirectionalType(draft.type)

  const renderEditForm = () =>
    editingModel ? (
      <SheetView className="p-[20px] gap-[22px]">
        <VStack className="overflow-hidden border-continuous gap-[10px]">
          <HStack className="overflow-hidden border-continuous items-center flex-wrap">
            <Text className="font-bold text-[14px]" numberOfLines={1} style={{ flexShrink: 1 }}>
              {getEndpointLabel(editingModel.activeEndpoint)}
            </Text>
            <TouchableBox
              className="overflow-hidden border-continuous ml-[6px] pl-[10px] py-[6px] rounded-tl-[16px] rounded-bl-[16px] bg-light-grey"
              onPress={cycleDraftType}
              style={{
                paddingRight: hasDirectionalType ? 6 : 10,
                marginRight: hasDirectionalType ? 0 : 6,
                borderBottomRightRadius: hasDirectionalType ? 0 : 16,
                borderTopRightRadius: hasDirectionalType ? 0 : 16,
              }}
            >
              <Text className="font-bold text-[12px] text-primary">
                {getDraftRelationText(editingModel)}
              </Text>
            </TouchableBox>
            {hasDirectionalType ? (
              <TouchableBox
                className="border-continuous overflow-hidden mr-[6px] pl-[4px] pr-[6px] h-[28px] rounded-tr-[16px] rounded-br-[16px] border-l-[1px] border-reverse bg-light-grey items-center justify-center"
                onPress={toggleDirection}
              >
                <MaterialIcon name="swap-horiz" size={16} color="primary" />
              </TouchableBox>
            ) : null}
            <Text className="font-bold text-[14px]">
              {editingModel.targetEndpoint.type === 'note' ||
              editingModel.targetEndpoint.type === 'study'
                ? `${t('une')} `
                : ''}
            </Text>
            <Box className="overflow-hidden border-continuous mx-[4px]">
              <TargetIcon type={editingModel.targetEndpoint.type} />
            </Box>
            <Text className="font-bold text-[14px]" numberOfLines={1} style={{ flexShrink: 1 }}>
              {editingModel.targetEndpoint.type === 'note'
                ? t('note')
                : editingModel.targetEndpoint.type === 'study'
                  ? t('étude')
                  : getDraftTargetTitle(editingModel)}
            </Text>
          </HStack>
          {getRelationSubtitle(editingModel) ? (
            <Text className="text-[13px] text-tertiary" numberOfLines={1}>
              {getRelationSubtitle(editingModel)}
            </Text>
          ) : null}
        </VStack>

        <VStack className="overflow-hidden border-continuous gap-[8px] mt-auto items-end">
          {isLabelExpanded ? (
            <VStack className="overflow-hidden border-continuous gap-[8px] self-stretch">
              <Text className="text-[13px] text-tertiary">{t('Libellé')}</Text>
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
              className="overflow-hidden border-continuous flex-row items-center justify-end py-[6px]"
              onPress={() => setIsLabelExpanded(true)}
            >
              <Text className="text-[12px] text-tertiary">{t('Ajouter un libellé')}</Text>
              <FeatherIcon
                name="chevron-down"
                size={14}
                color="tertiary"
                style={{ marginLeft: 4 }}
              />
            </TouchableBox>
          )}
        </VStack>
      </SheetView>
    ) : null

  const renderRelation = (model: RelationDisplayModel, index: number, sectionLength: number) => {
    const relationTitle = getRelationTitleParts(model, relationTitlePrefixes, t)
    const relationSubtitle = getRelationSubtitle(model)
    const menuActions: MenuAction[] = [
      ...(model.relation.kind !== 'system'
        ? [
            {
              id: 'edit',
              title: t('Modifier'),
              image: 'pencil',
            } as MenuAction,
          ]
        : []),
      {
        id: 'delete',
        title: t('Supprimer'),
        image: 'trash',
        attributes: { destructive: true },
      },
    ]

    return (
      <Box className="overflow-hidden border-continuous" key={model.relation.id}>
        <Box className="border-continuous overflow-hidden absolute top-[0px] left-[20px] border-l-[4px] border-b-[4px] rounded-bl-[50px] h-[35px] w-[25px] border-border" />
        {index !== sectionLength - 1 && (
          <Box className="border-continuous overflow-hidden absolute top-[0px] bottom-[0px] left-[20px] border-l-[4px] w-[25px] border-border" />
        )}
        {!model.isTargetAvailable ? <MissingTargetWarningIcon /> : null}

        <Box
          className="border-continuous overflow-hidden flex-[1] flex-row items-center ml-[60px] pl-[0px] border-b-[1px] border-border"
          style={{ opacity: !model.isTargetAvailable ? 0.5 : 1 }}
        >
          <TouchableBox
            className="overflow-hidden border-continuous flex-[1] flex-row items-center py-[10px]"
            onPress={() => openRelationTarget(model)}
          >
            <Box className="overflow-hidden border-continuous flex-[1]">
              <HStack className="overflow-hidden border-continuous items-center">
                <Text className="font-bold text-[14px]" numberOfLines={1}>
                  {relationTitle.prefix}
                </Text>
                <Box className="overflow-hidden border-continuous mx-[6px]">
                  <TargetIcon type={model.targetEndpoint.type} />
                </Box>
                <Text className="font-bold text-[14px]" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {relationTitle.target}
                </Text>
              </HStack>
              {relationSubtitle ? (
                <Text className="text-[12px] text-tertiary" numberOfLines={1}>
                  {relationSubtitle}
                </Text>
              ) : null}
              {model.relation.label ? (
                <Text className="text-[12px] text-tertiary" numberOfLines={1}>
                  {model.relation.label}
                </Text>
              ) : null}
            </Box>
          </TouchableBox>
          <ContextualMenu
            panelTitle={t('Relations')}
            icons={{ edit: 'edit-3', delete: 'trash-2' }}
            onPanelClose={() => setEditingModel(null)}
            screens={{
              edit: {
                title: t('Modifier la relation'),
                width: 500,
                onEnter: () => openEditModal(model, false),
                content: navigation => (
                  <>
                    {renderEditForm()}
                    <Box className="flex-row justify-end gap-3 p-3">
                      <Button
                        reverse
                        onPress={() => {
                          closeEditModal()
                          navigation.back()
                        }}
                      >
                        {t('Annuler')}
                      </Button>
                      <Button
                        onPress={() => {
                          saveEdit()
                          navigation.back()
                        }}
                      >
                        {t('Enregistrer')}
                      </Button>
                    </Box>
                  </>
                ),
              },
            }}
            actions={menuActions}
            onPressAction={({ nativeEvent }) => {
              if (nativeEvent.event === 'edit') openEditModal(model)
              if (nativeEvent.event === 'delete') confirmDelete(model)
            }}
          >
            <Box className="overflow-hidden border-continuous w-[42px] h-[42px] items-center justify-center">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </ContextualMenu>
        </Box>
      </Box>
    )
  }

  return (
    <VStack className="overflow-hidden border-continuous flex-[1]">
      {relations.length === 0 ? (
        <Box className="overflow-hidden border-continuous min-h-[220px]">
          <Empty
            iconElement={<FeatherIcon name="git-merge" size={64} color="primary" />}
            message={t('Aucune relation')}
          />
        </Box>
      ) : (
        sections.map(section => (
          <VStack className="overflow-hidden border-continuous mb-[12px]" key={section.id}>
            {section.title ? (
              <HStack className="overflow-hidden border-continuous items-center ml-[20px] py-[20px]">
                <TargetIcon type="verse" />
                <Text className="font-bold text-tertiary ml-[8px]">{section.title}</Text>
              </HStack>
            ) : null}
            {section.data.map((model, index) => renderRelation(model, index, section.data.length))}
          </VStack>
        ))
      )}

      <Sheet
        ref={editModalRef}
        header={
          <SheetHeader
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
                  <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
                    <FeatherIcon name="more-vertical" size={18} />
                  </Box>
                </MenuView>
              ) : undefined
            }
          />
        }
        footer={props => (
          <SheetFooter
            {...props}
            className={twMerge('gap-[10px] justify-end flex-row', props.className)}
          >
            <Box className="overflow-hidden border-continuous h-[54px]">
              <Button reverse onPress={closeEditModal}>
                {t('Annuler')}
              </Button>
            </Box>
            <Box className="overflow-hidden border-continuous h-[54px]">
              <Button onPress={saveEdit}>{t('Enregistrer')}</Button>
            </Box>
          </SheetFooter>
        )}
      >
        {renderEditForm()}
      </Sheet>
    </VStack>
  )
}

export default StudyRelationList
