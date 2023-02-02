import { useTheme } from '@emotion/react'
import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from 'react-native-paper'
import { NavigationStackProp } from 'react-navigation-stack'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import i18n from '~i18n'
import { SearchTab } from '../../state/tabs'
import LocalSearchScreen from './LocalSearchScreen'
import OnlineSearchScreen from './OnlineSearchScreen'

interface SearchScreenProps {
  navigation: NavigationStackProp
  searchAtom: PrimitiveAtom<SearchTab>
}

const SearchTabScreen = ({ searchAtom }: SearchScreenProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const [searchTab, setSearchTab] = useAtom(searchAtom)

  const {
    data: { searchValue, searchMode },
  } = searchTab

  const setSearchValue = (value: string) =>
    setSearchTab(
      produce(draft => {
        draft.data.searchValue = value
      })
    )

  const toggleSearchMode = () =>
    setSearchTab(
      produce(draft => {
        draft.data.searchMode =
          draft.data.searchMode === 'online' ? 'offline' : 'online'
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
      <Header
        title={t('Rechercher') + ' ' + t(`search.${searchMode}`)}
        rightComponent={
          <Box mr={20}>
            <Switch
              color={theme.colors.primary}
              value={searchMode === 'online'}
              onValueChange={toggleSearchMode}
            />
          </Box>
        }
      />
      {searchMode === 'online' ? (
        <OnlineSearchScreen
          searchValue={searchValue}
          setSearchValue={setSearchValue}
        />
      ) : (
        <LocalSearchScreen
          searchValue={searchValue}
          setSearchValue={setSearchValue}
        />
      )}
    </Container>
  )
}

SearchTabScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Rechercher'),
})

export default SearchTabScreen
