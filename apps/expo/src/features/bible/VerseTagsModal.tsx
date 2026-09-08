import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import EntityChipList from '~common/EntityChipList'
import { useUnifiedTagsModal } from '~common/UnifiedTagsModalProvider'
import { SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Chip } from '~common/ui/NewChip'
import Text from '~common/ui/Text'
import { EMPTY_ARRAY } from '~helpers/emptyReferences'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { makeTaggedItemsForVerseSelector, TaggedItem } from '~redux/selectors/bible'
import type { Theme as AppTheme } from '~themes'

const ItemRow = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[15px] border-b-[1px] border-b-border', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const IconContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'w-[36px] h-[36px] rounded-[12px] bg-light-grey items-center justify-center mr-[12px]',
      className
    )
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

interface VerseTagsModalProps {
  verseKey: string | null
  version: string
}

const getItemIcon = (type: TaggedItem['type']): 'edit-3' | 'file-text' | 'link' => {
  switch (type) {
    case 'highlight':
    case 'annotation':
      return 'edit-3'
    case 'note':
      return 'file-text'
    case 'link':
      return 'link'
  }
}

const getTaggedItemKey = (item: TaggedItem): string =>
  item.type === 'highlight' ? `highlight-${item.verseKey}` : `${item.type}-${item.data.id}`

const TaggedItemRow = ({ item, onEditTags }: { item: TaggedItem; onEditTags: () => void }) => {
  const { t } = useTranslation()

  const label = {
    highlight: t('Surbrillance'),
    annotation: t('Annotation'),
    note: t('Note'),
    link: t('Lien'),
  }[item.type]

  const icon = getItemIcon(item.type)

  // Get tags from the item data
  const tags = item.data.tags

  // Get additional info based on type
  const subtitle = (() => {
    switch (item.type) {
      case 'annotation':
        return `...${item.data.ranges[0]?.text || ''}...`
      case 'note':
        return item.data.title || ''
      case 'link':
        return item.data.customTitle || item.data.ogData?.title || item.data.url
      default:
        return ''
    }
  })()

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onEditTags}>
      <ItemRow>
        <IconContainer>
          <FeatherIcon
            name={icon}
            size={18}
            color={item.type === 'annotation' ? 'secondary' : 'primary'}
          />
        </IconContainer>
        <Box className="overflow-hidden border-continuous flex-[1]">
          <HStack className="overflow-hidden border-continuous gap-[6px] items-center">
            <Text className="font-bold text-[14px]">{label}</Text>
            {item.type === 'annotation' ? <Chip>{item.data.version}</Chip> : null}
          </HStack>
          {subtitle ? (
            <Text className="text-[12px] text-grey" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <EntityChipList tags={tags} />
        </Box>
        <FeatherIcon name="chevron-right" size={20} color="grey" />
      </ItemRow>
    </TouchableOpacity>
  )
}

const VerseTagsModal = forwardRef<SheetRef, VerseTagsModalProps>(({ verseKey, version }, ref) => {
  const { t } = useTranslation()
  const setUnifiedTagsModal = useUnifiedTagsModal()

  // Create selector for this verse
  const selectTaggedItems = makeTaggedItemsForVerseSelector()

  const taggedItems = useSelector((state: RootState) =>
    verseKey ? selectTaggedItems(state, verseKey, version) : EMPTY_ARRAY
  )

  // Get verse reference for header
  const reference = verseKey ? verseToReference({ [verseKey]: true }) : ''

  const handleEditTags = (item: TaggedItem) => {
    // Open UnifiedTagsModal with the appropriate entity
    switch (item.type) {
      case 'highlight':
        setUnifiedTagsModal({
          mode: 'select',
          ids: { [item.verseKey]: true as const },
          entity: 'highlights',
        })
        break
      case 'annotation':
        setUnifiedTagsModal({
          mode: 'select',
          id: item.data.id,
          entity: 'wordAnnotations',
          title: item.data.ranges[0]?.text,
        })
        break
      case 'note':
        setUnifiedTagsModal({
          mode: 'select',
          id: item.data.id,
          entity: 'notes',
          title: item.data.title,
        })
        break
      case 'link':
        setUnifiedTagsModal({
          mode: 'select',
          id: item.data.id,
          entity: 'links',
          title: item.data.customTitle || item.data.ogData?.title || item.data.url,
        })
        break
    }
  }

  return (
    <Sheet
      ref={ref}
      snapPoints={[0.5]}
      header={<SheetHeader title={t('Étiquettes')} subTitle={reference} />}
    >
      <Box className="overflow-hidden border-continuous">
        {taggedItems.length === 0 ? (
          <Box className="overflow-hidden border-continuous items-center justify-center py-[40px]">
            <Text className="text-grey">{t('Aucun élément avec des étiquettes')}</Text>
          </Box>
        ) : (
          taggedItems.map(item => (
            <TaggedItemRow
              key={getTaggedItemKey(item)}
              item={item}
              onEditTags={() => handleEditTags(item)}
            />
          ))
        )}
      </Box>
    </Sheet>
  )
})

VerseTagsModal.displayName = 'VerseTagsModal'

export default VerseTagsModal
