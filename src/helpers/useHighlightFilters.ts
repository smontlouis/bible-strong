import { useCallback, useMemo, useRef, useState } from 'react'
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
  resetFilters: () => void

  // Derived values
  activeFiltersCount: number
  filterLabel: string | undefined
  colorInfo?: { name: string; hex: string }
  selectedTag?: Tag

  // Modal refs (imperative API)
  mainModalRef: React.RefObject<BottomSheetModal | null>
  colorModalRef: React.RefObject<BottomSheetModal | null>
  tagsModalRef: React.RefObject<BottomSheetModal | null>

  // Modal actions
  openMainModal: () => void
  openColorFromMain: () => void
  openTagsFromMain: () => void
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

  // Derived values
  const colorInfo = useColorInfo(filters.colorId)
  const activeFiltersCount = (filters.colorId ? 1 : 0) + (filters.tagId ? 1 : 0)

  const filterLabel = useMemo(() => {
    if (activeFiltersCount === 0) return undefined
    if (activeFiltersCount === 1) {
      return colorInfo?.name || selectedTag?.name
    }
    return `${activeFiltersCount} ${t('filtres')}`
  }, [activeFiltersCount, colorInfo, selectedTag, t])

  // Filter setters
  const setColorFilter = useCallback((colorId?: string) => {
    setFilters(f => ({ ...f, colorId }))
  }, [])

  const setTagFilter = useCallback((tag?: Tag) => {
    setSelectedTag(tag)
    setFilters(f => ({ ...f, tagId: tag?.id }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({})
    setSelectedTag(undefined)
  }, [])

  // Modal navigation (imperative API)
  const openMainModal = useCallback(() => {
    mainModalRef.current?.present()
  }, [])

  const openColorFromMain = useCallback(() => {
    colorModalRef.current?.present()
  }, [])

  const openTagsFromMain = useCallback(() => {
    tagsModalRef.current?.present()
  }, [])

  return {
    filters,
    setColorFilter,
    setTagFilter,
    resetFilters,
    activeFiltersCount,
    filterLabel,
    colorInfo,
    selectedTag,
    mainModalRef,
    colorModalRef,
    tagsModalRef,
    openMainModal,
    openColorFromMain,
    openTagsFromMain,
  }
}
