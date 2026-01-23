import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import type { HighlightFilters } from '~common/types'
import { useColorInfo } from './useColorName'

interface Tag {
  id: string
  name: string
}

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
  mainModalRef: React.RefObject<BottomSheetModal | null>
  colorModalRef: React.RefObject<BottomSheetModal | null>
  tagsModalRef: React.RefObject<BottomSheetModal | null>
  typeModalRef: React.RefObject<BottomSheetModal | null>

  // Modal actions
  openMainModal: () => void
  openColorFromMain: () => void
  openTagsFromMain: () => void
  openTypeFromMain: () => void
}

export function useHighlightFilters(): UseHighlightFiltersReturn {
  const { t } = useTranslation()

  // Filter state
  const [filters, setFilters] = useState<HighlightFilters>({})
  const [selectedTag, setSelectedTag] = useState<Tag>()

  // Modal refs (imperative API - no booleans)
  const mainModalRef = useRef<BottomSheetModal>(null)
  const colorModalRef = useRef<BottomSheetModal>(null)
  const tagsModalRef = useRef<BottomSheetModal>(null)
  const typeModalRef = useRef<BottomSheetModal>(null)

  // Derived values
  const colorInfo = useColorInfo(filters.colorId)

  // Type filter label
  const getTypeFilterLabel = (): string => {
    if (!filters.typeFilter || filters.typeFilter === 'all') {
      return t('Tout')
    }
    if (filters.typeFilter === 'annotations') {
      return t('Annotations')
    }
    // It's a version code
    return filters.typeFilter
  }

  const typeFilterLabel = getTypeFilterLabel()

  // Active filters count includes type filter
  const activeFiltersCount =
    (filters.colorId ? 1 : 0) +
    (filters.tagId ? 1 : 0) +
    (filters.typeFilter && filters.typeFilter !== 'all' ? 1 : 0)

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
    setSelectedTag(tag)
    setFilters(f => ({ ...f, tagId: tag?.id }))
  }

  const setTypeFilter = (type?: string) => {
    setFilters(f => ({ ...f, typeFilter: type }))
  }

  const resetFilters = () => {
    setFilters({})
    setSelectedTag(undefined)
  }

  // Modal navigation (imperative API)
  const openMainModal = () => {
    mainModalRef.current?.present()
  }

  const openColorFromMain = () => {
    colorModalRef.current?.present()
  }

  const openTagsFromMain = () => {
    tagsModalRef.current?.present()
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
    mainModalRef,
    colorModalRef,
    tagsModalRef,
    typeModalRef,
    openMainModal,
    openColorFromMain,
    openTagsFromMain,
    openTypeFromMain,
  }
}
