import { Sheet, SheetHeader, SheetScrollView } from '~common/sheet'
import { useAtom } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'

import { Tag } from '~common/types'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useSheet } from '~helpers/useSheet'
import useFuzzy from '~helpers/useFuzzy'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { unifiedTagsModalAtom, type UnifiedTagsModalProps } from '~state/app'
import SheetSearchInput from './SheetSearchInput'
import { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'

const RemovableChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <AnimatedBox
    entering={FadeIn}
    exiting={FadeOut}
    layout={LinearTransition}
    row
    bg="primary"
    borderRadius={20}
    px={12}
    py={5}
    alignItems="center"
  >
    <Text color="reverse" fontSize={14} numberOfLines={1} maxWidth={200}>
      {label}
    </Text>
    <TouchableOpacity onPress={onRemove} style={{ marginLeft: 6 }}>
      <FeatherIcon name="x" size={14} color="reverse" />
    </TouchableOpacity>
  </AnimatedBox>
)

type UnifiedTagsModalInstanceProps = {
  item: UnifiedTagsModalProps
  setItem: (item: UnifiedTagsModalProps) => void
}

export const UnifiedTagsModalInstance = ({ item, setItem }: UnifiedTagsModalInstanceProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { bottomBarHeight } = useBottomBarHeightInTab()

  const { ref, open, close } = useSheet()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  // Calculate current items and selected tags for select mode
  type EntityItem = { id?: string; title?: string; tags?: Record<string, Tag> }
  type EntityData = Record<string, EntityItem>

  // For select mode: get entity data and selected tags
  const entityData = useSelector((state: RootState) => {
    if (!item || item.mode !== 'select') return undefined
    return item.entity ? (state.user.bible[item.entity] as unknown as EntityData) : undefined
  })

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
    <Sheet
      ref={ref}
      snapPoints={[0.7]}
      onDismiss={() => setItem(false)}
      header={
        <>
          <SheetHeader title={getTitle()}>
            <Box px={20} pb={10}>
              <SheetSearchInput
                placeholder={t('Chercher ou creer une etiquette')}
                onChangeText={search}
                onDelete={resetSearch}
                value={keyword}
                returnKeyType="done"
                onSubmitEditing={() => (!result.length ? saveTag() : undefined)}
              />
            </Box>
          </SheetHeader>
          {hasSelectedTags && (
            <AnimatedBox
              layout={LinearTransition}
              px={16}
              py={8}
              borderBottomWidth={1}
              borderColor="border"
            >
              <Text fontSize={12} color="grey" mb={6}>
                {t('tagsSelected', { count: selectedTagsList.length })}
              </Text>
              <Box row wrap style={{ gap: 8 }}>
                {selectedTagsList.map(tag => (
                  <RemovableChip
                    key={tag.id}
                    label={tag.name}
                    onRemove={() => handleRemoveTag(tag.id)}
                  />
                ))}
              </Box>
            </AnimatedBox>
          )}
        </>
      }
    >
      <SheetScrollView
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
                    borderColor={isSelected ? 'primary' : 'border'}
                    bg={isSelected ? 'primary' : undefined}
                    center
                  >
                    {isSelected && <FeatherIcon name="check" size={14} color="white" />}
                  </Box>
                  <Text flex={1} fontSize={16}>
                    {tag.name}
                  </Text>
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
      </SheetScrollView>
    </Sheet>
  )
}

const UnifiedTagsModal = () => {
  const [item, setItem] = useAtom(unifiedTagsModalAtom)

  return <UnifiedTagsModalInstance item={item} setItem={setItem} />
}

export default UnifiedTagsModal
