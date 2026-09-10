import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import TagOptionsPanel from './TagOptionsPanel'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import { useAtom } from 'jotai/react'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useDispatch, useSelector, useStore } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import { type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { pageContentStyle } from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'

import { LegendList } from '@legendapp/list'
import { useTranslation } from 'react-i18next'
import { ActionSheetItem } from '~common/ActionMenu'
import ChoiceFilterModal, { type ChoiceFilterOption } from '~common/ChoiceFilterModal'
import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Link from '~common/Link'
import RenameModal from '~common/RenameModal'
import SearchFilterModal from '~common/SearchFilterModal'
import { Tag } from '~common/types'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import FabButton from '~common/ui/FabButton'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import { queryTagList, type TagListRow } from '~features/entityListQuery/tagListQuery'
import { useSheet } from '~helpers/useSheet'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { RootState } from '~redux/modules/reducer'
import { addTag, removeTag, updateTag } from '~redux/modules/user'
import { makeTagDataSelector } from '~redux/selectors/bible'
import { selectTagListRows } from '~redux/selectors/tags'
import {
  defaultTagListQueryState,
  tagListQueryAtom,
  type TagListSort,
} from '~state/entityListFilters'
import { useCreateTabGroupFromTag } from './useCreateTabGroupFromTag'

const Chip = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'rounded-[20px] bg-border pt-[3px] pb-[3px] pl-[7px] pr-[7px] mr-[5px] mb-[5px] mt-[5px]',
    className
  )
  return (
    <Box
      {...props}
      style={[props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

type TagItemProps = {
  item: TagListRow
  setOpen: (tag: Tag) => void
}

const TagItem = ({ item, setOpen }: TagItemProps) => {
  const { t } = useTranslation()
  const highlightsNumber = item.counts.highlights + item.counts.wordAnnotations
  const notesNumber = item.counts.notes
  const linksNumber = item.counts.links
  const studiesNumber = item.counts.studies
  const strongsNumber = item.counts.strongsHebreu + item.counts.strongsGrec
  const wordsNumber = item.counts.words
  const navesNumber = item.counts.naves

  return (
    <Box className="overflow-hidden border-continuous">
      <Link route="Tag" params={{ tagId: item.id }}>
        <Box className="overflow-hidden border-continuous p-[20px] flex-row pr-[0px] py-[10px]">
          <Box className="overflow-hidden border-continuous flex-[1] justify-center">
            <Text className="font-bold">{item.title}</Text>
            <Box className="overflow-hidden border-continuous flex-row">
              {!!strongsNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {strongsNumber} {t('strong', { count: strongsNumber })}
                  </Text>
                </Chip>
              )}
              {!!wordsNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {wordsNumber} {t('dictionnaire', { count: wordsNumber })}
                  </Text>
                </Chip>
              )}
              {!!navesNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {navesNumber} {t('nave', { count: navesNumber })}
                  </Text>
                </Chip>
              )}
              {!!highlightsNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {highlightsNumber} {t('surbrillance', { count: highlightsNumber })}
                  </Text>
                </Chip>
              )}
              {!!notesNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {notesNumber} {t('note', { count: notesNumber })}
                  </Text>
                </Chip>
              )}
              {!!studiesNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {studiesNumber} {t('étude', { count: studiesNumber })}
                  </Text>
                </Chip>
              )}
              {!!linksNumber && (
                <Chip>
                  <Text className="text-[10px] text-default">
                    {linksNumber} {t('lien', { count: linksNumber })}
                  </Text>
                </Chip>
              )}
            </Box>
          </Box>
          <TagOptionsPanel tag={item.tag} />
        </Box>
      </Link>
      <Border className="mx-[10px]" />
    </Box>
  )
}

type TagsScreenProps = {
  isFormSheet?: boolean
}

const TagsScreen = ({ isFormSheet = false }: TagsScreenProps) => {
  const confirmDeletion = useConfirmDialog()
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
  useEffect(() => {
    if (isOpen) {
      open()
    }
  }, [isOpen, open])

  const promptLogout = () => {
    void confirmDeletion({
      title: t('Attention'),
      message: t('Êtes-vous vraiment sur de supprimer ce tag ?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    }).then(confirmed => {
      if (!confirmed) return
      dispatch(removeTag(isOpen?.id || ''))
      close()
    })
  }

  const handleOpenInTabGroup = () => {
    if (!isOpen) return
    const tagData = selectTagData(store.getState(), isOpen)
    createTabGroupFromTag(isOpen, tagData)
    close()
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton={hasBackButton}
          title={t('Étiquettes')}
          onReset={() => setQueryState(defaultTagListQueryState)}
          filters={[
            {
              key: 'search',
              content: () => (
                <PanelSearch
                  value={queryState.query}
                  onChange={query => setQueryState(state => ({ ...state, query }))}
                />
              ),
              icon: 'search',
              label: t('Rechercher'),
              value: queryState.query.trim() || undefined,
              active: Boolean(queryState.query.trim()),
              onPress: () => searchModalRef.current?.present(),
            },
            {
              key: 'sort',
              options: sortOptions.map(option => ({
                key: option.value,
                label: option.label,
                selected: queryState.sort === option.value,
                onSelect: () => setQueryState(state => ({ ...state, sort: option.value })),
              })),
              icon: 'list',
              label: t('Ordre'),
              value: sortLabel,
              active: queryState.sort !== defaultTagListQueryState.sort,
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
            renderItem={({ item }) => <TagItem setOpen={setOpen} item={item} />}
            keyExtractor={item => item.id}
            contentContainerStyle={[pageContentStyle, { paddingBottom: 70 }]}
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
          accessibilityLabel={t('accessibility.addTag')}
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
