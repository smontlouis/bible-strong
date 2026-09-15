import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import Container from '~common/ui/Container'
import i18n from '~i18n'
import { SearchTab } from '../../state/tabs'
import SQLiteSearchScreen from './SQLiteSearchScreen'

interface SearchScreenProps {
  searchAtom: PrimitiveAtom<SearchTab>
}

const SearchTabScreen = ({ searchAtom }: SearchScreenProps) => {
  const { t } = useTranslation()

  const [searchTab, setSearchTab] = useAtom(searchAtom)

  const {
    data: { searchValue },
  } = searchTab

  const setSearchValue = (value: string) =>
    setSearchTab(
      produce(draft => {
        draft.data.searchValue = value
        delete draft.data.draftSearchValue
        draft.title = value || t('Recherche')
      })
    )

  useEffect(() => {
    const title = searchValue || t('Recherche')
    setSearchTab(previous => (previous.title === title ? previous : { ...previous, title }))
  }, [searchValue, setSearchTab, t])

  return (
    <Container>
      <SQLiteSearchScreen
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        initialDraft={searchTab.data.draftSearchValue}
        draftKey={searchAtom}
        onSaveDraft={value =>
          setSearchTab(previous => {
            const draftSearchValue = value === previous.data.searchValue ? undefined : value
            return previous.data.draftSearchValue === draftSearchValue
              ? previous
              : { ...previous, data: { ...previous.data, draftSearchValue } }
          })
        }
        initialFilters={searchTab.data.filters}
        onFiltersChange={filters =>
          setSearchTab(previous => ({
            ...previous,
            data: { ...previous.data, filters: { ...previous.data.filters, ...filters } },
          }))
        }
      />
    </Container>
  )
}

SearchTabScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Rechercher'),
})

export default SearchTabScreen
