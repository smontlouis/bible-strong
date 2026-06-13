import React, { useState, useEffect } from 'react'
import { MenuView } from '~common/ui/MenuView'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'

import * as Icon from '@expo/vector-icons'
import SectionList from '~common/ui/SectionList'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Link from '~common/Link'
import SearchInput from '~common/SearchInput'
import Loading from '~common/Loading'
import type { NaveLetterRow, NaveSearchRow } from '~features/resources/naveAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import Empty from '~common/Empty'
import AlphabetList from '~common/AlphabetList'
import SectionTitle from '~common/SectionTitle'
import waitForNaveDB from '~common/waitForNaveDB'
import useLanguage from '~helpers/useLanguage'

import NaveItem from './NaveItem'
import { useSearchValue, useResultsByLetterOrSearch } from '../lexique/useUtilities'
import { useTranslation } from 'react-i18next'
import { NaveTab } from '../../state/tabs'
import { PrimitiveAtom } from 'jotai/vanilla'
import type { DatabaseError } from '~helpers/catchDatabaseError'
import { toast } from '~helpers/toast'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useResolveNewTabSelection } from '~features/app-switcher/utils/useResolveNewTabSelection'
import { useResourceLanguage } from 'src/state/resourcesLanguage'

type NaveRow = NaveLetterRow | NaveSearchRow
type NaveSection = {
  title: string
  data: NaveRow[]
}

const isDatabaseError = (value: unknown): value is DatabaseError =>
  !!value && typeof value === 'object' && 'error' in value

const getNaveItemLayout = sectionListGetItemLayout({
  getItemHeight: () => 60,
  getSectionHeaderHeight: () => 50,
  getSeparatorHeight: () => 0,
  getSectionFooterHeight: () => 0,
}) as (data: NaveSection[], index: number) => { length: number; offset: number; index: number }

const useSectionResults = (results: NaveRow[]) => {
  const [sectionResults, setSectionResults] = useState<NaveSection[]>([])

  useEffect(() => {
    if (!results.length) {
      setSectionResults([])
      return
    }
    const sectionResults = results.reduce<NaveSection[]>((list, naveItem) => {
      const listItem = list.find(item => item.title === naveItem.letter)
      if (!listItem) {
        list.push({ title: naveItem.letter, data: [naveItem] })
      } else {
        listItem.data.push(naveItem)
      }

      return list
    }, [])
    setSectionResults(sectionResults)
  }, [results])

  return sectionResults
}

interface NaveListScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
  hasBackButton?: boolean
  isFormSheet?: boolean
  isNewTabSelection?: boolean
  newTabId?: string
  onNaveSelect?: (name_lower: string, name: string) => void
}

const NaveListScreen = ({
  hasBackButton,
  isFormSheet = false,
  isNewTabSelection = false,
  newTabId,
  onNaveSelect,
}: NaveListScreenProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resolveNewTabSelection = useResolveNewTabSelection(newTabId)
  const canGoBackInStack = useCanGoBackInStack()
  const showBackButton = isFormSheet ? canGoBackInStack : hasBackButton
  const lang = useLanguage()
  const [naveResourceLanguage, setNaveResourceLanguage] = useResourceLanguage('NAVE')
  const [error, setError] = useState<DatabaseError['error'] | null>(null)
  const [letter, setLetter] = useState('a')
  const { searchValue, debouncedSearchValue, setSearchValue } = useSearchValue()

  const { results, isLoading } = useResultsByLetterOrSearch(
    { query: resources.nave.search, value: debouncedSearchValue },
    { query: resources.nave.listByLetter, value: letter }
  )
  const naveResults = Array.isArray(results) ? (results as NaveRow[]) : []
  const sectionResults = useSectionResults(naveResults)

  useEffect(() => {
    if (isDatabaseError(results)) {
      setError(results.error)
    }
  }, [results])

  const selectNave = (nameLower: string, name: string) => {
    if (isNewTabSelection) {
      resolveNewTabSelection({
        id: newTabId || 'new',
        title: name,
        isRemovable: true,
        type: 'nave',
        data: {
          name_lower: nameLower,
          name,
        },
      })
      return
    }

    onNaveSelect?.(nameLower, name)
  }

  const toggleNaveLanguage = () => {
    const nextLanguage = naveResourceLanguage === 'fr' ? 'en' : 'fr'
    setNaveResourceLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguage === 'fr' ? 'Français' : 'English' }))
  }

  if (error) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Box flex bg="reverse">
          <Header hasBackButton={showBackButton} title={t('Désolé...')} />
          <Empty
            icon={require('~assets/images/empty-state-icons/inbox.svg')}
            message={`${t('Impossible de charger la nave...')}${
              error === 'CORRUPTED_DATABASE'
                ? t(
                    '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                  )
                : ''
            }`}
          />
        </Box>
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <Header
          hasBackButton={showBackButton}
          title={t('Thématique Nave')}
          rightComponent={
            <Box row alignItems="center">
              {lang === 'fr' && (
                <Link route="NaveWarning" padding>
                  <Icon.Feather size={20} name="alert-triangle" color="rgb(255,188,0)" />
                </Link>
              )}
              <MenuView
                actions={[
                  {
                    id: 'language',
                    title: `${t('menu.language')}: ${
                      naveResourceLanguage === 'fr' ? 'Français' : 'English'
                    }`,
                    image: 'globe',
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (nativeEvent.event === 'language') toggleNaveLanguage()
                }}
              >
                <Box row center height={60} width={60}>
                  <Icon.Feather name="more-vertical" size={18} />
                </Box>
              </MenuView>
            </Box>
          }
        >
          <Box pb={10} px={20}>
            <SearchInput
              placeholder={t('Recherche par mot')}
              onChangeText={setSearchValue}
              value={searchValue}
              onDelete={() => setSearchValue('')}
            />
          </Box>
        </Header>
        <Box flex paddingTop={20}>
          {isLoading ? (
            <Loading message={t('Chargement...')} />
          ) : sectionResults.length ? (
            <SectionList<NaveRow, NaveSection>
              renderItem={({ item: { name_lower, name } }) => (
                <NaveItem
                  key={name_lower}
                  name_lower={name_lower}
                  name={name}
                  onSelect={isNewTabSelection || onNaveSelect ? selectNave : undefined}
                />
              )}
              removeClippedSubviews
              maxToRenderPerBatch={100}
              getItemLayout={(data, index) =>
                getNaveItemLayout((data || []) as NaveSection[], index)
              }
              renderSectionHeader={({ section: { title } }) => (
                <SectionTitle color="quint">
                  <Text title fontWeight="bold" fontSize={16} style={{ color: 'white' }}>
                    {title.toUpperCase()}
                  </Text>
                </SectionTitle>
              )}
              stickySectionHeadersEnabled
              sections={sectionResults}
              keyExtractor={(item: NaveRow) => item.name_lower}
            />
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/word.svg')}
              message={t('Aucun mot trouvé...')}
            />
          )}
        </Box>
        {!searchValue && <AlphabetList color="quint" letter={letter} setLetter={setLetter} />}
      </Box>
    </FormSheetScreen>
  )
}

export default waitForNaveDB({
  hasHeader: true,
  hasBackButton: true,
})(NaveListScreen)
