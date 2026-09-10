import { goBackOrHome } from '~navigation/goBackOrHome'
import { type SheetRef } from '~common/sheet'
import React, { useRef, useState } from 'react'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useDispatch } from 'react-redux'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import RenameModal from '~common/RenameModal'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import PanelTextForm from '~common/ContextualPanel/PanelTextForm'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Empty from '~common/Empty'
import { FeatherIcon } from '~common/ui/Icon'
import HighlightItem from '~features/settings/Verse'
import StudyItem from '~features/studies/StudyItem'
import { removeTag, updateTag } from '~redux/modules/user'
import useLanguage from '~helpers/useLanguage'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useTagData } from './useTagData'
import { TagData, useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'
import {
  buildTagSections,
  NoteItem,
  LinkItem,
  TagSectionHeader,
  type TagSection,
  type TagSectionItem,
} from './tagDetailShared'
import TagStrongItem from './TagStrongItem'
import TagNaveItem from './TagNaveItem'
import TagDictionaryItem from './TagDictionaryItem'
import AnnotationItem from './AnnotationItem'
import { IS_FORM_SHEET } from '~helpers/constants'
const TagScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ tagId?: string }>()
  const tagId = params.tagId || ''
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true

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

  const confirm = useConfirmDialog()
  const renameModalRef = useRef<SheetRef>(null)
  const [tagToRename, setTagToRename] = useState<{ id: string; name: string } | null>(null)
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([])

  const toggle = (sectionId: string) => {
    setExpandedSectionIds(s =>
      s.includes(sectionId) ? s.filter(i => i !== sectionId) : [...s, sectionId]
    )
  }

  const sections = buildTagSections(
    {
      strongsGrec,
      strongsHebreu,
      naves,
      words,
      highlights,
      notes,
      links,
      studies,
      wordAnnotations,
    },
    expandedSectionIds,
    t
  )

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
            version={item.data.version}
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

  const handleDelete = async () => {
    if (!tag) return
    if (
      await confirm({
        title: t('Attention'),
        message: t('Êtes-vous vraiment sur de supprimer ce tag ?'),
        cancelLabel: t('Non'),
        confirmLabel: t('Oui'),
        destructive: true,
      })
    ) {
      dispatch(removeTag(tag.id))
      goBackOrHome(router)
    }
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
  }

  if (!tag) {
    return (
      <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
        <Header hasBackButton={hasBackButton} title="" />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Cette étiquette n'existe pas...")}
        />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous">
        <Header
          hasBackButton={hasBackButton}
          title={tag.name}
          rightComponent={
            <ContextualMenu
              panelTitle={tag.name}
              icons={{ edit: 'edit-3', 'create-group': 'layers', delete: 'trash-2' }}
              screens={{
                edit: {
                  title: t("Renommer l'étiquette"),
                  width: 380,
                  content: navigation => (
                    <PanelTextForm
                      initialValue={tag.name}
                      label={t("Nom de l'étiquette")}
                      onSave={value => {
                        dispatch(updateTag(tag.id, value))
                        navigation.back()
                      }}
                    />
                  ),
                },
              }}
              actions={[
                { id: 'edit', title: t('Éditer'), image: 'pencil' },
                {
                  id: 'create-group',
                  title: t('tabs.createGroupFromTag'),
                  image: 'square.stack.3d.up',
                },
                {
                  id: 'delete',
                  title: t('Supprimer'),
                  image: 'trash',
                  attributes: { destructive: true },
                },
              ]}
              onPressAction={({ nativeEvent }) => {
                switch (nativeEvent.event) {
                  case 'edit':
                    setTagToRename({ id: tag.id, name: tag.name })
                    renameModalRef.current?.present()
                    break
                  case 'create-group':
                    handleOpenInTabGroup()
                    break
                  case 'delete':
                    handleDelete()
                    break
                }
              }}
            >
              <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
                <FeatherIcon name="more-vertical" size={18} />
              </Box>
            </ContextualMenu>
          }
        />
        <RenameModal
          sheetRef={renameModalRef}
          title={t("Renommer l'étiquette")}
          placeholder={t("Nom de l'étiquette")}
          initialValue={tagToRename?.name}
          onSave={value => {
            if (tagToRename) {
              dispatch(updateTag(tagToRename.id, value))
            }
          }}
        />
      </Box>
      {isEmpty ? (
        <Box className="overflow-hidden border-continuous flex-[1] pt-[40px] px-[20px]">
          <Empty
            icon={require('~assets/images/empty-state-icons/tag.svg')}
            message={t("Vous n'avez rien enregistré avec cette étiquette...")}
          />
        </Box>
      ) : (
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
        />
      )}
    </FormSheetScreen>
  )
}

export default TagScreen
