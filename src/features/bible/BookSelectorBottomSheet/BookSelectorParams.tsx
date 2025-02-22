import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import PopOverMenu from '~common/PopOverMenu'
import Box from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import {
  bookSelectorSelectionModeAtom,
  bookSelectorSortAtom,
  bookSelectorVersesAtom,
} from './atom'

export const BookSelectorParams = () => {
  const { t } = useTranslation()

  const [sort, setSort] = useAtom(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const [selectionMode, setSelectionMode] = useAtom(
    bookSelectorSelectionModeAtom
  )
  const [verses, setVerses] = useAtom(bookSelectorVersesAtom)
  const hasVerses = verses === 'with-verses'

  const handleSortToggle = () => {
    setSort(prev => (prev === 'alphabetical' ? 'classical' : 'alphabetical'))
  }

  return (
    <PopOverMenu
      popover={
        <>
          <MenuOption onSelect={handleSortToggle} closeOnSelect={false}>
            <Box row alignItems="center" width={180}>
              <MaterialIcon
                name="sort-by-alpha"
                size={22}
                color={isAlphabetical ? 'primary' : 'grey'}
              />
              <Text marginLeft={10} numberOfLines={1}>
                {isAlphabetical
                  ? t('bookSelector.sort.alphabetical')
                  : t('bookSelector.sort.classical')}
              </Text>
            </Box>
          </MenuOption>

          <MenuOption
            onSelect={() => {
              setVerses(v =>
                v === 'with-verses' ? 'without-verses' : 'with-verses'
              )
            }}
            closeOnSelect={false}
          >
            <Box row alignItems="center">
              <MaterialIcon
                name="format-list-numbered"
                size={20}
                color={hasVerses ? 'primary' : 'grey'}
              />
              <Text marginLeft={10}>
                {hasVerses
                  ? t('bookSelector.withVerses')
                  : t('bookSelector.withoutVerses')}
              </Text>
            </Box>
          </MenuOption>
          <MenuOption
            onSelect={() => {
              setSelectionMode(s => (s === 'grid' ? 'list' : 'grid'))
            }}
            closeOnSelect={false}
          >
            <Box row alignItems="center">
              <FeatherIcon
                name={selectionMode === 'grid' ? 'grid' : 'menu'}
                size={20}
              />
              <Text marginLeft={10}>
                {selectionMode === 'grid'
                  ? t('bookSelector.selectionMode.grid')
                  : t('bookSelector.selectionMode.list')}
              </Text>
            </Box>
          </MenuOption>
        </>
      }
    />
  )
}
