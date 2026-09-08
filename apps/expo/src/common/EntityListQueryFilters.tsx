import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TextInput } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'

import ChoiceFilterModal, { type ChoiceFilterOption } from './ChoiceFilterModal'
import SearchFilterModal from './SearchFilterModal'
import type { SheetRef } from './sheet'
import type { EntityListSort } from '~features/entityListQuery/entityListQuery'

type Props = {
  query: string
  sort: EntityListSort
  sortOptions: readonly ChoiceFilterOption<EntityListSort>[]
  onQueryChange: (query: string) => void
  onSortChange: (sort: EntityListSort) => void
}

export const useEntityListQueryFilters = ({
  query,
  sort,
  sortOptions,
  onQueryChange,
  onSortChange,
}: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const searchRef = useRef<SheetRef>(null)
  const sortRef = useRef<SheetRef>(null)
  const sortLabel = sortOptions.find(option => option.value === sort)?.label || sort

  return {
    sortLabel,
    filters: [
      {
        key: 'search',
        icon: 'search' as const,
        label: t('Rechercher'),
        value: query.trim() || undefined,
        active: Boolean(query.trim()),
        onPress: () => searchRef.current?.present(),
        content: () => (
          <TextInput
            accessibilityLabel={t('Rechercher')}
            placeholder={t('Rechercher')}
            value={query}
            onChangeText={onQueryChange}
            style={{
              color: theme.colors.default,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              margin: 8,
            }}
          />
        ),
      },
      {
        key: 'sort',
        icon: 'list' as const,
        label: t('Ordre'),
        value: sortLabel,
        active: sort !== 'newest',
        onPress: () => sortRef.current?.present(),
        options: sortOptions.map(option => ({
          key: option.value,
          label: option.label,
          selected: sort === option.value,
          onSelect: () => onSortChange(option.value),
        })),
      },
    ],
    modals: (
      <>
        <SearchFilterModal
          ref={searchRef}
          title={t('Rechercher')}
          placeholder={t('Rechercher')}
          value={query}
          onChange={onQueryChange}
        />
        <ChoiceFilterModal
          ref={sortRef}
          title={t('Ordre')}
          selectedValue={sort}
          options={sortOptions}
          onSelect={value => {
            onSortChange(value)
            sortRef.current?.dismiss()
          }}
        />
      </>
    ),
  }
}
