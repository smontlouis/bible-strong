import { BottomSheetModal } from '@gorhom/bottom-sheet/'
import React, { useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch } from 'react-redux'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import PopOverMenu from '~common/PopOverMenu'
import RenameModal from '~common/RenameModal'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Empty from '~common/Empty'
import HighlightItem from '~features/settings/Verse'
import StudyItem from '~features/studies/StudyItem'
import { removeTag, updateTag } from '~redux/modules/user'
import useLanguage from '~helpers/useLanguage'

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

const TagScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ tagId?: string }>()
  const tagId = params.tagId || ''
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()

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

  const renameModalRef = useRef<BottomSheetModal>(null)
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

  const handleDelete = () => {
    if (!tag) return
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: () => {
          dispatch(removeTag(tag.id))
          router.back()
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
  }

  if (!tag) {
    return (
      <Container>
        <Header hasBackButton title="" />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Cette étiquette n'existe pas...")}
        />
      </Container>
    )
  }

  return (
    <Container>
      <Header
        hasBackButton
        title={tag.name}
        rightComponent={
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
        }
      />
      {isEmpty ? (
        <Box flex pt={40} px={20}>
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
    </Container>
  )
}

export default TagScreen
