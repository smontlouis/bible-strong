import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import FiltersHeader, { type FiltersHeaderItem } from '~common/FiltersHeader'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'

export function useBookSelectorFilters({ includeLayout = true }: { includeLayout?: boolean } = {}) {
  const { t } = useTranslation()
  const [sort, setSort] = useAtom(bookSelectorSortAtom)
  const [selectionMode, setSelectionMode] = useAtom(bookSelectorSelectionModeAtom)
  const [verses, setVerses] = useAtom(bookSelectorVersesAtom)
  const filters: FiltersHeaderItem[] = [
    {
      key: 'sort',
      icon: 'list',
      label: t('Ordre'),
      value: t('bookSelector.sort.' + sort),
      active: sort !== 'classical',
      onPress: () => {},
      options: (['classical', 'alphabetical'] as const).map(value => ({
        key: value,
        label: t('bookSelector.sort.' + value),
        selected: sort === value,
        onSelect: () => setSort(value),
      })),
    },
    {
      key: 'verses',
      icon: 'hash',
      label: t('Verset'),
      value: t(verses === 'with-verses' ? 'bookSelector.withVerses' : 'bookSelector.withoutVerses'),
      active: verses === 'with-verses',
      onPress: () => {},
      options: (['without-verses', 'with-verses'] as const).map(value => ({
        key: value,
        label: t(
          value === 'with-verses' ? 'bookSelector.withVerses' : 'bookSelector.withoutVerses'
        ),
        selected: verses === value,
        onSelect: () => setVerses(value),
      })),
    },
  ]
  if (includeLayout)
    filters.push({
      key: 'layout',
      icon: 'grid',
      label: t('Affichage'),
      value: t('bookSelector.selectionMode.' + selectionMode),
      active: selectionMode !== 'list',
      onPress: () => {},
      options: (['list', 'grid'] as const).map(value => ({
        key: value,
        label: t('bookSelector.selectionMode.' + value),
        selected: selectionMode === value,
        onSelect: () => setSelectionMode(value),
      })),
    })
  return {
    filters,
    onReset: () => {
      setSort('classical')
      setVerses('without-verses')
      if (includeLayout) setSelectionMode('list')
    },
  }
}

export const BookSelectorParams = ({ includeLayout = true }: { includeLayout?: boolean }) => {
  const filters = useBookSelectorFilters({ includeLayout })
  return <FiltersHeader buttonOnly title="" {...filters} />
}
