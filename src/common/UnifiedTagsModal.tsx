import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useAtom } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'

import { Tag } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import useFuzzy from '~helpers/useFuzzy'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { unifiedTagsModalAtom } from '~state/app'
import BottomSheetSearchInput from './BottomSheetSearchInput'

const RemovableChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <Box row bg="primary" borderRadius={20} px={12} py={5} mr={8} alignItems="center">
    <Text color="reverse" fontSize={14}>
      {label}
    </Text>
    <TouchableOpacity onPress={onRemove} style={{ marginLeft: 6 }}>
      <FeatherIcon name="x" size={14} color="reverse" />
    </TouchableOpacity>
  </Box>
)

const UnifiedTagsModal = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const [item, setItem] = useAtom(unifiedTagsModalAtom)
  const { ref, open, close } = useBottomSheetModal()

  const tags = useSelector(sortedTagsSelector)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })

  const [highlightTitle, setHighlightTitle] = useState('')

  // Auto-open when atom changes
  useEffect(() => {
    if (item) {
      open()
      resetSearch()
    }
  }, [item])

  // For select mode: get entity data and selected tags
  const entityData = useSelector((state: RootState) => {
    if (!item || item.mode !== 'select') return undefined
    // @ts-ignore - Dynamic entity access
    return item.entity ? state.user.bible[item.entity] : undefined
  }) as Record<string, { tags?: Record<string, Tag>; title?: string }> | undefined

  // Calculate current items and selected tags for select mode
  type EntityItem = { id?: string; title?: string; tags?: Record<string, Tag> }

  const { currentItems, selectedTags } = ((): {
    currentItems: EntityItem[]
    selectedTags: Record<string, Tag>
  } => {
    if (!item || item.mode !== 'select') {
      return { currentItems: [], selectedTags: {} }
    }

    const items: EntityItem[] =
      'ids' in item && item.ids
        ? Object.keys(item.ids).map(id => ({ id, ...entityData?.[id] }))
        : [entityData && item.id ? { id: item.id, ...entityData[item.id] } : {}]

    const tags = items.reduce<Record<string, Tag>>((acc, curr) => ({ ...acc, ...curr.tags }), {})

    return { currentItems: items, selectedTags: tags }
  })()

  // Generate title for highlights in select mode
  useEffect(() => {
    if (item && item.mode === 'select' && 'ids' in item && item.ids) {
      const title = verseToReference(item.ids)
      setHighlightTitle(title)
    }
  }, [item])

  const saveTag = () => {
    if (!keyword.trim()) return
    dispatch(addTag(keyword.trim()))
    resetSearch()
  }

  const handleTagPress = (tag: Tag) => {
    if (!item) return

    if (item.mode === 'filter') {
      item.onSelect(tag)
      handleClose()
    } else {
      // Extract select mode properties for toggleTagEntity
      const { entity, id, ids, title } = item
      dispatch(toggleTagEntity({ item: { entity, id, ids, title }, tagId: tag.id }))
    }
  }

  const handleAllPress = () => {
    if (!item || item.mode !== 'filter') return
    item.onSelect(undefined)
    handleClose()
  }

  const handleRemoveTag = (tagId: string) => {
    if (!item || item.mode !== 'select') return
    // Extract select mode properties for toggleTagEntity
    const { entity, id, ids, title } = item
    dispatch(toggleTagEntity({ item: { entity, id, ids, title }, tagId }))
  }

  const handleClose = () => {
    close()
    // Reset atom after a short delay to allow animation
    setTimeout(() => setItem(false), 100)
  }

  const getTitle = (): string => {
    if (!item || item.mode === 'filter') return t('Etiquettes')
    if (item.title) return item.title

    // Select mode without explicit title
    if (item.entity === 'highlights') {
      return `${t('Etiquettes pour')} ${highlightTitle.replace(/[\r\n]+/g, ' ')}`
    }
    return `${t('Etiquettes pour')} "${currentItems[0]?.title || ''}"`
  }

  const isTagSelected = (tag: Tag) => {
    if (!item) return false
    if (item.mode === 'filter') {
      return item.selectedTag?.id === tag.id
    }
    return Boolean(selectedTags[tag.id])
  }

  const selectedTagsList: Tag[] = Object.values(selectedTags)
  const isSelectMode = item !== false && item.mode === 'select'
  const isFilterMode = item !== false && item.mode === 'filter'
  const hasSelectedTags = isSelectMode && selectedTagsList.length > 0
  const filterModeSelectedTag = isFilterMode ? item.selectedTag : undefined

  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      enablePanDownToClose
      snapPoints={['70%']}
      backdropComponent={renderBackdrop}
      activeOffsetY={[-20, 20]}
      onDismiss={() => setItem(false)}
      key={key}
      {...bottomSheetStyles}
    >
      {/* Header */}
      <Box pt={20} pb={10} px={20} borderBottomWidth={1} borderColor="border">
        <Text bold fontSize={16}>
          {getTitle()}
        </Text>
        <Box height={8} />
        <BottomSheetSearchInput
          placeholder={t('Chercher ou creer une etiquette')}
          onChangeText={search}
          onDelete={resetSearch}
          value={keyword}
          returnKeyType="done"
          onSubmitEditing={() => (!result.length ? saveTag() : undefined)}
        />
      </Box>

      {/* Selected tags chips (select mode only) */}
      {hasSelectedTags && (
        <Box px={16} py={8} borderBottomWidth={1} borderColor="border">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Box row>
              {selectedTagsList.map(tag => (
                <RemovableChip
                  key={tag.id}
                  label={tag.name}
                  onRemove={() => handleRemoveTag(tag.id)}
                />
              ))}
            </Box>
          </ScrollView>
        </Box>
      )}

      <BottomSheetScrollView
        contentContainerStyle={{
          paddingBottom: bottomBarHeight,
        }}
      >
        {result.length || !keyword ? (
          <>
            {/* "Tout" option (filter mode only) */}
            {isFilterMode && (
              <TouchableBox
                row
                alignItems="center"
                p={16}
                borderBottomWidth={1}
                borderColor="border"
                onPress={handleAllPress}
              >
                <Box
                  width={24}
                  height={24}
                  borderRadius={6}
                  mr={12}
                  borderWidth={2}
                  borderColor="border"
                  center
                >
                  {!filterModeSelectedTag && <FeatherIcon name="check" size={14} color="primary" />}
                </Box>
                <Text flex={1} fontSize={16}>
                  {t('Tout')}
                </Text>
                {!filterModeSelectedTag && <FeatherIcon name="check" size={20} color="primary" />}
              </TouchableBox>
            )}

            {/* Tag rows */}
            {result.map((tag: Tag) => {
              const isSelected = isTagSelected(tag)
              return (
                <TouchableBox
                  key={tag.id}
                  row
                  alignItems="center"
                  p={16}
                  borderBottomWidth={1}
                  borderColor="border"
                  onPress={() => handleTagPress(tag)}
                >
                  <Box
                    width={24}
                    height={24}
                    borderRadius={6}
                    mr={12}
                    borderWidth={2}
                    borderColor="border"
                    center
                  >
                    {isSelected && <FeatherIcon name="check" size={14} color="primary" />}
                  </Box>
                  <Text flex={1} fontSize={16}>
                    {tag.name}
                  </Text>
                  {isSelected && <FeatherIcon name="check" size={20} color="primary" />}
                </TouchableBox>
              )
            })}

            {/* Empty state for select mode with no tags */}
            {isSelectMode && result.length === 0 && !keyword && (
              <Box flex center py={20}>
                <Text textAlign="center" width={200} bold color="lightPrimary">
                  {t('Creez votre premier tag puis selectionnez-le !')}
                </Text>
              </Box>
            )}
          </>
        ) : (
          <TouchableBox
            row
            alignItems="center"
            p={16}
            borderBottomWidth={1}
            borderColor="border"
            onPress={saveTag}
          >
            <FeatherIcon size={20} color="primary" name="tag" />
            <Text ml={10} bold color="primary">
              {`${t('Creer')} "${keyword}"`}
            </Text>
          </TouchableBox>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

export default UnifiedTagsModal
