import styled from '@emotion/native'
import { Sheet, type SheetRef } from '~common/sheet'
import React, { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { shallowEqual, useDispatch, useSelector, useStore } from 'react-redux'

import { useTranslation } from 'react-i18next'
import { ActionSheetItem } from '~common/ActionMenu'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import RenameModal from '~common/RenameModal'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import FabButton from '~common/ui/FabButton'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { LegendList } from '@legendapp/list'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useFuzzy from '~helpers/useFuzzy'
import { useSheet } from '~helpers/useSheet'
import { addTag, removeTag, updateTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { Tag } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

const Chip = styled(Box)(({ theme }) => ({
  borderRadius: 20,
  backgroundColor: theme.colors.border,
  paddingTop: 3,
  paddingBottom: 3,
  paddingLeft: 7,
  paddingRight: 7,
  marginRight: 5,
  marginBottom: 5,
  marginTop: 5,
}))

type TagItemProps = {
  item: Tag
  setOpen: (tag: Tag) => void
}

const TagItem = ({ item, setOpen }: TagItemProps) => {
  const { t } = useTranslation()
  const selectTagData = useRef(makeTagDataSelector()).current
  const tagData = useSelector((state: RootState) => selectTagData(state, item))
  const highlightsNumber = tagData.highlights.length + tagData.wordAnnotations.length
  const notesNumber = tagData.notes.length
  const linksNumber = tagData.links.length
  const studiesNumber = tagData.studies.length
  const strongsNumber = tagData.strongsHebreu.length + tagData.strongsGrec.length
  const wordsNumber = tagData.words.length
  const navesNumber = tagData.naves.length

  return (
    <Box>
      <Link route="Tag" params={{ tagId: item.id }}>
        <Box padding={20} row pr={0} py={10}>
          <Box flex justifyContent="center">
            <Text bold>{item.name}</Text>
            <Box row>
              {!!strongsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {strongsNumber} {t('strong', { count: strongsNumber })}
                  </Text>
                </Chip>
              )}
              {!!wordsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {wordsNumber} {t('dictionnaire', { count: wordsNumber })}
                  </Text>
                </Chip>
              )}
              {!!navesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {navesNumber} {t('nave', { count: navesNumber })}
                  </Text>
                </Chip>
              )}
              {!!highlightsNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {highlightsNumber} {t('surbrillance', { count: highlightsNumber })}
                  </Text>
                </Chip>
              )}
              {!!notesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {notesNumber} {t('note', { count: notesNumber })}
                  </Text>
                </Chip>
              )}
              {!!studiesNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {studiesNumber} {t('étude', { count: studiesNumber })}
                  </Text>
                </Chip>
              )}
              {!!linksNumber && (
                <Chip>
                  <Text fontSize={10} color="default">
                    {linksNumber} {t('lien', { count: linksNumber })}
                  </Text>
                </Chip>
              )}
            </Box>
          </Box>
          <Link onPress={() => setOpen(item)} padding>
            <FeatherIcon name="more-vertical" size={20} />
          </Link>
        </Box>
      </Link>
      <Border marginHorizontal={10} />
    </Box>
  )
}

type TagsScreenProps = {
  isFormSheet?: boolean
}

const TagsScreen = ({ isFormSheet = false }: TagsScreenProps) => {
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const tags = useSelector(sortedTagsSelector, shallowEqual)
  const [isOpen, setOpen] = useState<Tag | undefined>(undefined)
  const renameModalRef = useRef<SheetRef>(null)
  const [tagToEdit, setTagToEdit] = useState<{ id: string; name: string } | null>(null)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })
  const dispatch = useDispatch()
  const { ref, open, close } = useSheet()
  const store = useStore<RootState>()
  const selectTagData = makeTagDataSelector()
  const createTabGroupFromTag = useCreateTabGroupFromTag()

  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer ce tag ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(removeTag(isOpen?.id || ''))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const handleOpenInTabGroup = () => {
    if (!isOpen) return
    const tagData = selectTagData(store.getState(), isOpen)
    createTabGroupFromTag(isOpen, tagData)
    close()
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header hasBackButton={hasBackButton} title={t('Étiquettes')}>
          <Box pb={10} px={20}>
            <SearchInput
              placeholder={t('Chercher une étiquette')}
              onChangeText={search}
              onDelete={resetSearch}
              value={keyword}
              returnKeyType="done"
            />
          </Box>
        </Header>
        {result.length ? (
          <LegendList
            data={result}
            renderItem={({ item }: { item: Tag }) => <TagItem setOpen={setOpen} item={item} />}
            keyExtractor={(item: Tag) => item.id}
            contentContainerStyle={{ paddingBottom: 70 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/tag.svg')}
            message={t('Aucune étiquette...')}
          />
        )}

        <Sheet ref={ref} onDismiss={() => setOpen(undefined)}>
          <ActionSheetItem
            icon="edit-3"
            label={t('Éditer')}
            onPress={() => {
              if (!isOpen) return

              close()
              setTagToEdit({ id: isOpen.id, name: isOpen.name })
              renameModalRef.current?.present()
            }}
          />
          <ActionSheetItem
            icon="layers"
            label={t('tabs.createGroupFromTag')}
            onPress={handleOpenInTabGroup}
          />
          <ActionSheetItem
            icon="trash-2"
            label={t('Supprimer')}
            color="quart"
            onPress={promptLogout}
          />
        </Sheet>
        <RenameModal
          sheetRef={renameModalRef}
          title={tagToEdit?.id ? t("Renommer l'étiquette") : t('Nouvelle étiquette')}
          placeholder={t("Nom de l'étiquette")}
          initialValue={tagToEdit?.name}
          onSave={value => {
            if (tagToEdit?.id) {
              dispatch(updateTag(tagToEdit.id, value))
            } else {
              dispatch(addTag(value))
            }
          }}
        />
        <FabButton
          icon="plus"
          onPress={() => {
            setTagToEdit({ id: '', name: '' })
            renameModalRef.current?.present()
          }}
        />
      </Box>
    </FormSheetScreen>
  )
}

export default TagsScreen
