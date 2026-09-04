import { MenuView } from '~common/ui/MenuView'
import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'

export const BookSelectorParams = () => {
  const { t } = useTranslation()

  const [sort, setSort] = useAtom(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const [selectionMode, setSelectionMode] = useAtom(bookSelectorSelectionModeAtom)
  const [verses, setVerses] = useAtom(bookSelectorVersesAtom)
  const hasVerses = verses === 'with-verses'

  const handleSortToggle = () => {
    setSort(prev => (prev === 'alphabetical' ? 'classical' : 'alphabetical'))
  }

  const handleVersesToggle = () => {
    setVerses(v => (v === 'with-verses' ? 'without-verses' : 'with-verses'))
  }

  const handleSelectionModeToggle = () => {
    setSelectionMode(s => (s === 'grid' ? 'list' : 'grid'))
  }

  return (
    <MenuView
      actions={[
        {
          id: 'sort',
          title: isAlphabetical
            ? t('bookSelector.sort.alphabetical')
            : t('bookSelector.sort.classical'),
          image: 'list.bullet',
        },
        {
          id: 'verses',
          title: hasVerses ? t('bookSelector.withVerses') : t('bookSelector.withoutVerses'),
          image: 'number',
        },
        {
          id: 'selection-mode',
          title:
            selectionMode === 'grid'
              ? t('bookSelector.selectionMode.grid')
              : t('bookSelector.selectionMode.list'),
          image: selectionMode === 'grid' ? 'square.grid.2x2' : 'list.bullet',
        },
      ]}
      onPressAction={({ nativeEvent }) => {
        switch (nativeEvent.event) {
          case 'sort':
            handleSortToggle()
            break
          case 'verses':
            handleVersesToggle()
            break
          case 'selection-mode':
            handleSelectionModeToggle()
            break
        }
      }}
    >
      <Box row center height={54} width={60}>
        <FeatherIcon name="more-vertical" size={18} />
      </Box>
    </MenuView>
  )
}
