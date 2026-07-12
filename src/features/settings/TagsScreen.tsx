import styled from '@emotion/native'
import { Sheet, type SheetRef } from '~common/sheet'
import React, { useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { useAtom } from 'jotai/react'

import { useTranslation } from 'react-i18next'
import { ActionSheetItem } from '~common/ActionMenu'
import ChoiceFilterModal, { type ChoiceFilterOption } from '~common/ChoiceFilterModal'
import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Link from '~common/Link'
import RenameModal from '~common/RenameModal'
import SearchFilterModal from '~common/SearchFilterModal'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import FabButton from '~common/ui/FabButton'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { LegendList } from '@legendapp/list'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useSheet } from '~helpers/useSheet'
import { addTag, removeTag, updateTag } from '~redux/modules/user'
import { selectTagListRows } from '~redux/selectors/tags'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { Tag } from '~common/types'
import { RootState } from '~redux/modules/reducer'
import { useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { queryTagList } from '~features/entityListQuery/tagListQuery'
import {
  defaultTagListQueryState,
  tagListQueryAtom,
  type TagListSort,
} from '~state/entityListFilters'

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
  const tagRows = useSelector(selectTagListRows)
  const [queryState, setQueryState] = useAtom(tagListQueryAtom)
  const [isOpen, setOpen] = useState<Tag | undefined>(undefined)
  const renameModalRef = useRef<SheetRef>(null)
  const [tagToEdit, setTagToEdit] = useState<{ id: string; name: string } | null>(null)
  const dispatch = useDispatch()
  const { ref, open, close } = useSheet()
  const searchModalRef = useRef<SheetRef>(null)
  const sortModalRef = useRef<SheetRef>(null)
  const store = useStore<RootState>()
  const selectTagData = makeTagDataSelector()
  const createTabGroupFromTag = useCreateTabGroupFromTag()
  const result = queryTagList(tagRows, queryState)

  const sortOptions: readonly ChoiceFilterOption<TagListSort>[] = [
    { value: 'name-asc', label: t('entityList.sort.nameAsc') },
    { value: 'name-desc', label: t('entityList.sort.nameDesc') },
    { value: 'count-asc', label: t('entityList.sort.countAsc') },
    { value: 'count-desc', label: t('entityList.sort.countDesc') },
  ]
  const sortLabel =
    sortOptions.find(option => option.value === queryState.sort)?.label ||
    t('entityList.sort.nameAsc') ||
    queryState.sort
  const activeFiltersCount =
    (queryState.query.trim() ? 1 : 0) + (queryState.sort !== defaultTagListQueryState.sort ? 1 : 0)
  const filterLabel =
    activeFiltersCount === 1
      ? queryState.query.trim() || sortLabel
      : activeFiltersCount > 1
        ? `${activeFiltersCount} ${t('filtres')}`
        : undefined

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
        <FiltersHeader
          hasBackButton={hasBackButton}
          title={t('Étiquettes')}
          filterLabel={filterLabel}
          hasActiveFilters={activeFiltersCount > 0}
          onReset={() => setQueryState(defaultTagListQueryState)}
          filters={[
            {
              key: 'search',
              icon: 'search',
              label: t('Rechercher'),
              value: queryState.query.trim() || t('Tout'),
              onPress: () => searchModalRef.current?.present(),
            },
            {
              key: 'sort',
              icon: 'list',
              label: t('Ordre'),
              value: sortLabel,
              onPress: () => sortModalRef.current?.present(),
            },
          ]}
        />
        <SearchFilterModal
          ref={searchModalRef}
          title={t('Rechercher')}
          placeholder={t('Chercher une étiquette')}
          value={queryState.query}
          onChange={query => setQueryState(state => ({ ...state, query }))}
        />
        <ChoiceFilterModal
          ref={sortModalRef}
          title={t('Ordre')}
          selectedValue={queryState.sort}
          options={sortOptions}
          onSelect={sort => {
            setQueryState(state => ({ ...state, sort }))
            sortModalRef.current?.dismiss()
          }}
        />
        {result.length ? (
          <LegendList
            data={result}
            renderItem={({ item }) => <TagItem setOpen={setOpen} item={item.tag} />}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 70 }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/tag.svg')}
            message={
              tagRows.length
                ? t('Aucun résultat trouvé pour "{{query}}"', { query: queryState.query })
                : t('Aucune étiquette...')
            }
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
