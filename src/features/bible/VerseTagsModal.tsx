import styled from '@emotion/native'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { useSetAtom } from 'jotai/react'
import React, { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import TagList from '~common/TagList'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { Chip } from '~common/ui/NewChip'
import Text from '~common/ui/Text'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { makeTaggedItemsForVerseSelector, TaggedItem } from '~redux/selectors/bible'
import { multipleTagsModalAtom } from '~state/app'

const ItemRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const IconContainer = styled.View(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
}))

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
    <TouchableOpacity onPress={onEditTags}>
      <ItemRow>
        <IconContainer>
          <FeatherIcon
            name={icon}
            size={18}
            color={item.type === 'annotation' ? 'secondary' : 'primary'}
          />
        </IconContainer>
        <Box flex>
          <HStack gap={6} alignItems="center">
            <Text bold fontSize={14}>
              {label}
            </Text>
            {item.type === 'annotation' ? <Chip>{item.data.version}</Chip> : null}
          </HStack>
          {subtitle ? (
            <Text fontSize={12} color="grey" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <TagList tags={tags} />
        </Box>
        <FeatherIcon name="chevron-right" size={20} color="grey" />
      </ItemRow>
    </TouchableOpacity>
  )
}

const VerseTagsModal = forwardRef<BottomSheetModal, VerseTagsModalProps>(
  ({ verseKey, version }, ref) => {
    const { t } = useTranslation()
    const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)

    // Create selector for this verse
    const selectTaggedItems = makeTaggedItemsForVerseSelector()

    const taggedItems = useSelector((state: RootState) =>
      verseKey ? selectTaggedItems(state, verseKey, version) : []
    )

    // Get verse reference for header
    const reference = verseKey ? verseToReference({ [verseKey]: true }) : ''

    const handleEditTags = (item: TaggedItem) => {
      // Open MultipleTagsModal with the appropriate entity
      switch (item.type) {
        case 'highlight':
          setMultipleTagsItem({
            ids: { [item.verseKey]: true as const },
            entity: 'highlights',
          })
          break
        case 'annotation':
          setMultipleTagsItem({
            id: item.data.id,
            entity: 'wordAnnotations',
            title: item.data.ranges[0]?.text,
          })
          break
        case 'note':
          setMultipleTagsItem({
            id: item.data.id,
            entity: 'notes',
            title: item.data.title,
          })
          break
        case 'link':
          setMultipleTagsItem({
            id: item.data.id,
            entity: 'links',
            title: item.data.customTitle || item.data.ogData?.title || item.data.url,
          })
          break
      }
    }

    return (
      <Modal.Body
        ref={ref}
        snapPoints={['50%']}
        headerComponent={
          <ModalHeader
            title={`${t('Étiquettes pour')} ${reference}`}
            subTitle={t('Cliquez sur un élément pour modifier ses étiquettes')}
          />
        }
      >
        <Box>
          {taggedItems.length === 0 ? (
            <Box center py={40}>
              <Text color="grey">{t('Aucun élément avec des étiquettes')}</Text>
            </Box>
          ) : (
            taggedItems.map((item, index) => (
              <TaggedItemRow
                key={`${item.type}-${index}`}
                item={item}
                onEditTags={() => handleEditTags(item)}
              />
            ))
          )}
        </Box>
      </Modal.Body>
    )
  }
)

VerseTagsModal.displayName = 'VerseTagsModal'

export default VerseTagsModal
