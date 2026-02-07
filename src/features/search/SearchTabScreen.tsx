import produce from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
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
      })
    )

  const setTitle = (title: string) =>
    setSearchTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(searchValue || t('Recherche'))
  }, [searchValue])

  return (
    <Container>
      <Header title={t('Rechercher')} />
      <SQLiteSearchScreen searchValue={searchValue} setSearchValue={setSearchValue} />
    </Container>
  )
}

SearchTabScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Rechercher'),
})

export default SearchTabScreen
