import { BottomSheetHandle, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Empty from '~common/Empty'
import ModalHeader from '~common/ModalHeader'
import PopOverMenu from '~common/PopOverMenu'
import RenameModal from '~common/RenameModal'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import AnnotationItem from '~features/settings/AnnotationItem'
import TagDictionaryItem from '~features/settings/TagDictionaryItem'
import TagNaveItem from '~features/settings/TagNaveItem'
import TagStrongItem from '~features/settings/TagStrongItem'
import { TagData, useCreateTabGroupFromTag } from '~features/settings/useCreateTabGroupFromTag'
import { useTagData } from '~features/settings/useTagData'
import {
  buildTagSections,
  NoteItem,
  LinkItem,
  TagSectionHeader,
  type TagSection,
  type TagSectionItem,
} from '~features/settings/tagDetailShared'
import HighlightItem from '~features/settings/Verse'
import StudyItem from '~features/studies/StudyItem'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import useLanguage from '~helpers/useLanguage'
import { removeTag, updateTag } from '~redux/modules/user'
import { tagDetailModalAtom } from '~state/app'
import { useBottomSheetModal } from '~helpers/useBottomSheet'

const TagDetailContent = ({ tagId }: { tagId: string }) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const insets = useSafeAreaInsets()
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([])

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

  if (!tag) {
    return (
      <Box flex pt={40} px={20}>
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Cette étiquette n'existe pas...")}
        />
      </Box>
    )
  }

  if (isEmpty) {
    return (
      <Box flex pt={40} px={20}>
        <Empty
          icon={require('~assets/images/empty-state-icons/tag.svg')}
          message={t("Vous n'avez rien enregistré avec cette étiquette...")}
        />
      </Box>
    )
  }

  return (
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
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    />
  )
}

const TagDetailModal = () => {
  const props = useAtomValue(tagDetailModalAtom)
  const setProps = useSetAtom(tagDetailModalAtom)
  const { ref, open, close } = useBottomSheetModal()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const renameModalRef = useRef<BottomSheetModal>(null)
  const [tagToRename, setTagToRename] = useState<{ id: string; name: string } | null>(null)
  const createTabGroupFromTag = useCreateTabGroupFromTag()

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
  } = useTagData(props ? props.tagId : '')

  useEffect(() => {
    if (props) {
      open()
    }
  }, [props, open])

  const handleClose = () => {
    close()
    setProps(false)
  }

  const handleDismiss = () => {
    setProps(false)
  }

  const handleDelete = () => {
    if (!tag) return
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: () => {
          dispatch(removeTag(tag.id))
          handleClose()
        },
      },
    ])
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
    handleClose()
  }

  const renderHandle = (handleProps: React.ComponentProps<typeof BottomSheetHandle>) => (
    <>
      <BottomSheetHandle {...handleProps} />
      <ModalHeader
        title={tag?.name || t('Étiquette')}
        rightComponent={
          tag ? (
            <Box>
              <PopOverMenu
                popover={
                  <>
                    <MenuOption
                      onSelect={() => {
                        setTagToRename({ id: tag.id, name: tag.name })
                        renameModalRef.current?.present()
                      }}
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="edit-3" size={15} />
                        <Text marginLeft={10}>{t('Éditer')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={handleOpenInTabGroup}>
                      <Box row alignItems="center">
                        <FeatherIcon name="layers" size={15} />
                        <Text marginLeft={10}>{t('tabs.createGroupFromTag')}</Text>
                      </Box>
                    </MenuOption>
                    <MenuOption onSelect={handleDelete}>
                      <Box row alignItems="center">
                        <FeatherIcon name="trash-2" size={15} color="quart" />
                        <Text marginLeft={10} color="quart">
                          {t('Supprimer')}
                        </Text>
                      </Box>
                    </MenuOption>
                  </>
                }
              />
            </Box>
          ) : undefined
        }
      />
    </>
  )

  if (!props) return null

  return (
    <>
      <BottomSheetModal
        ref={ref}
        topInset={insets.top}
        enablePanDownToClose
        snapPoints={['90%']}
        backdropComponent={renderBackdrop}
        activeOffsetY={[-20, 20]}
        onDismiss={handleDismiss}
        handleComponent={renderHandle}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <TagDetailContent tagId={props.tagId} />
        </BottomSheetView>
      </BottomSheetModal>

      <RenameModal
        bottomSheetRef={renameModalRef}
        title={t("Renommer l'étiquette")}
        placeholder={t("Nom de l'étiquette")}
        initialValue={tagToRename?.name}
        onSave={value => {
          if (tagToRename) {
            dispatch(updateTag(tagToRename.id, value))
          }
        }}
      />
    </>
  )
}

export default TagDetailModal
