import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtom, useSetAtom } from 'jotai/react'
import { useSelector } from 'react-redux'
import type { SheetRef } from '~common/sheet'
import type { HighlightFilters, Tag } from '~common/types'
import { useColorInfo } from './useColorName'
import { unifiedTagsModalAtom } from '~state/app'
import { highlightsListQueryAtom } from '~state/entityListFilters'
import type { RootState } from '~redux/modules/reducer'

interface UseHighlightFiltersReturn {
  // Filter state
  filters: HighlightFilters

  // Setters
  setColorFilter: (colorId?: string) => void
  setTagFilter: (tag?: Tag) => void
  setTypeFilter: (type?: string) => void
  resetFilters: () => void

  // Derived values
  activeFiltersCount: number
  filterLabel: string | undefined
  colorInfo?: { name: string; hex: string }
  selectedTag?: Tag
  typeFilterLabel: string

  // Modal refs (imperative API)
  colorModalRef: React.RefObject<SheetRef | null>
  typeModalRef: React.RefObject<SheetRef | null>

  // Modal actions
  openColorFromMain: () => void
  openTagsFromMain: () => void
  openTypeFromMain: () => void
}

export function useHighlightFilters(): UseHighlightFiltersReturn {
  const { t } = useTranslation()

  // Filter state
  const [filters, setFilters] = useAtom(highlightsListQueryAtom)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const selectedTag = filters.tagId ? tags[filters.tagId] : undefined

  // Modal refs (imperative API - no booleans)
  const colorModalRef = useRef<SheetRef>(null)
  const typeModalRef = useRef<SheetRef>(null)

  // Atom-based modal for tags
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)

  // Derived values
  const colorInfo = useColorInfo(filters.colorId)

  useEffect(() => {
    if (filters.tagId && !tags[filters.tagId]) {
      setFilters(state => ({ ...state, tagId: undefined }))
    }
    if (filters.colorId && !colorInfo) {
      setFilters(state => ({ ...state, colorId: undefined }))
    }
  }, [colorInfo, filters.colorId, filters.tagId, setFilters, tags])

  // Type filter label
  const getTypeFilterLabel = (): string => {
    if (!filters.typeFilter || filters.typeFilter === 'all') {
      return t('Tout')
    }
    if (filters.typeFilter === 'annotations') {
      return t('Annotations')
    }
    if (filters.typeFilter === 'highlights') {
      return t('Surbrillances')
    }
    // It's a version code
    return filters.typeFilter
  }

  const typeFilterLabel = getTypeFilterLabel()

  // Active filters count includes type filter
  const activeFiltersCount =
    (filters.colorId ? 1 : 0) +
    (filters.tagId ? 1 : 0) +
    (filters.typeFilter && filters.typeFilter !== 'all' ? 1 : 0) +
    (filters.testament && filters.testament !== 'all' ? 1 : 0) +
    (filters.book ? 1 : 0) +
    (filters.sort && filters.sort !== 'newest' ? 1 : 0)

  const getFilterLabel = (): string | undefined => {
    if (activeFiltersCount === 0) return undefined
    if (activeFiltersCount === 1) {
      if (filters.typeFilter && filters.typeFilter !== 'all') {
        return typeFilterLabel
      }
      return colorInfo?.name || selectedTag?.name
    }
    return `${activeFiltersCount} ${t('filtres')}`
  }

  const filterLabel = getFilterLabel()

  // Filter setters
  const setColorFilter = (colorId?: string) => {
    setFilters(f => ({ ...f, colorId }))
  }

  const setTagFilter = (tag?: Tag) => {
    setFilters(f => ({ ...f, tagId: tag?.id }))
  }

  const setTypeFilter = (type?: string) => {
    setFilters(f => ({ ...f, typeFilter: type }))
  }

  const resetFilters = () => {
    setFilters({})
  }

  // Modal navigation (imperative API)
  const openColorFromMain = () => {
    colorModalRef.current?.present()
  }

  const openTagsFromMain = () => {
    setUnifiedTagsModal({
      mode: 'filter',
      selectedTag,
      onSelect: setTagFilter,
    })
  }

  const openTypeFromMain = () => {
    typeModalRef.current?.present()
  }

  return {
    filters,
    setColorFilter,
    setTagFilter,
    setTypeFilter,
    resetFilters,
    activeFiltersCount,
    filterLabel,
    colorInfo,
    selectedTag,
    typeFilterLabel,
    colorModalRef,
    typeModalRef,
    openColorFromMain,
    openTagsFromMain,
    openTypeFromMain,
  }
}
