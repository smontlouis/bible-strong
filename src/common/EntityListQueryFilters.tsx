import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

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
  const searchRef = useRef<SheetRef>(null)
  const sortRef = useRef<SheetRef>(null)
  const sortLabel = sortOptions.find(option => option.value === sort)?.label || sort

  return {
    sortLabel,
    activeLabels: [query.trim() || undefined, sort !== 'newest' ? sortLabel : undefined],
    filters: [
      {
        key: 'search',
        icon: 'search' as const,
        label: t('Rechercher'),
        value: query.trim() || t('Tout'),
        onPress: () => searchRef.current?.present(),
      },
      {
        key: 'sort',
        icon: 'list' as const,
        label: t('Ordre'),
        value: sortLabel,
        onPress: () => sortRef.current?.present(),
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
