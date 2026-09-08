import { SheetHeader, SheetScrollView } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { useAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Tag } from '~common/types'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
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
const RemovableChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => {
  const { t } = useTranslation()

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous flex-row bg-primary rounded-[20px] px-[12px] py-[5px] items-center"
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
    >
      <Text className="text-reverse text-[14px] max-w-[200px]" numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        accessibilityLabel={t('accessibility.removeTag', { tag: label })}
        accessibilityRole="button"
        onPress={onRemove}
        style={{ marginLeft: 6 }}
      >
        <FeatherIcon name="x" size={14} color="reverse" />
      </TouchableOpacity>
    </AnimatedBox>
  )
}

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

  const highlightTitle =
    item && item.mode === 'select' && 'ids' in item && item.ids ? verseToReference(item.ids) : ''

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
            <Box className="overflow-hidden border-continuous px-[20px] pb-[10px]">
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
              className="overflow-hidden border-continuous px-[16px] py-[8px] border-b-[1px] border-border"
              layout={LinearTransition}
            >
              <Text className="text-[12px] text-grey mb-[6px]">
                {t('tagsSelected', { count: selectedTagsList.length })}
              </Text>
              <Box
                className="overflow-hidden border-continuous flex-row flex-wrap"
                style={{ gap: 8 }}
              >
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
                className="border-continuous overflow-hidden flex-row items-center p-[16px] border-b-[1px] border-border"
                onPress={handleAllPress}
              >
                <Checkbox className="mr-[12px]" checked={!filterModeSelectedTag} />
                <Text className="flex-[1] text-[16px]">{t('Tout')}</Text>
                {!filterModeSelectedTag && <FeatherIcon name="check" size={20} color="primary" />}
              </TouchableBox>
            )}

            {/* Tag rows */}
            {result.map((tag: Tag) => {
              const isSelected = isTagSelected(tag)
              return (
                <TouchableBox
                  className="border-continuous overflow-hidden flex-row items-center p-[16px] border-b-[1px] border-border"
                  key={tag.id}
                  onPress={() => handleTagPress(tag)}
                >
                  <Checkbox
                    className="mr-[12px]"
                    checked={isSelected}
                    fillChecked
                    checkColor="white"
                  />
                  <Text className="flex-[1] text-[16px]">{tag.name}</Text>
                </TouchableBox>
              )
            })}

            {/* Empty state for select mode with no tags */}
            {isSelectMode && result.length === 0 && !keyword && (
              <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center py-[20px]">
                <Text className="text-center w-[200px] font-bold text-light-primary">
                  {t('Creez votre premier tag puis selectionnez-le !')}
                </Text>
              </Box>
            )}
          </>
        ) : (
          <TouchableBox
            className="border-continuous overflow-hidden flex-row items-center p-[16px] border-b-[1px] border-border"
            onPress={saveTag}
          >
            <FeatherIcon size={20} color="primary" name="tag" />
            <Text className="ml-[10px] font-bold text-primary">{`${t('Creer')} "${keyword}"`}</Text>
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
