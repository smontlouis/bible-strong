import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import { ActionSheetItem } from '~common/ActionMenu'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'

export const BookSelectorParams = () => {
  const { t } = useTranslation()
  const { ref, open, close } = useBottomSheetModal()

  const [sort, setSort] = useAtom(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const [selectionMode, setSelectionMode] = useAtom(bookSelectorSelectionModeAtom)
  const [verses, setVerses] = useAtom(bookSelectorVersesAtom)
  const hasVerses = verses === 'with-verses'

  const handleSortToggle = () => {
    setSort(prev => (prev === 'alphabetical' ? 'classical' : 'alphabetical'))
    close()
  }

  const handleVersesToggle = () => {
    setVerses(v => (v === 'with-verses' ? 'without-verses' : 'with-verses'))
    close()
  }

  const handleSelectionModeToggle = () => {
    setSelectionMode(s => (s === 'grid' ? 'list' : 'grid'))
    close()
  }

  return (
    <>
      <TouchableBox onPress={open}>
        <Box row center height={54} width={60}>
          <FeatherIcon name="more-vertical" size={18} />
        </Box>
      </TouchableBox>
      <Modal.Body
        ref={ref}
        enableDynamicSizing
        enableScrollView={false}
        stackBehavior="push"
        headerComponent={
          <Box px={20} py={15} center borderColor="border" borderBottomWidth={1}>
            <Text bold>{t('Paramètres')}</Text>
          </Box>
        }
      >
        <ActionSheetItem
          icon="list"
          label={
            isAlphabetical ? t('bookSelector.sort.alphabetical') : t('bookSelector.sort.classical')
          }
          onPress={handleSortToggle}
        />
        <ActionSheetItem
          icon="hash"
          label={hasVerses ? t('bookSelector.withVerses') : t('bookSelector.withoutVerses')}
          onPress={handleVersesToggle}
        />
        <ActionSheetItem
          icon={selectionMode === 'grid' ? 'grid' : 'menu'}
          label={
            selectionMode === 'grid'
              ? t('bookSelector.selectionMode.grid')
              : t('bookSelector.selectionMode.list')
          }
          onPress={handleSelectionModeToggle}
        />
      </Modal.Body>
    </>
  )
}
