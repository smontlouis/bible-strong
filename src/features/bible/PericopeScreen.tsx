import { Fragment, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import books from '~assets/bible_versions/books-desc'
import ScrollView from '~common/ui/ScrollView'
import PericopeHeader from './PericopeHeader'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'
import { useTranslation } from 'react-i18next'
import { useQuery } from '~helpers/react-query-lite'
import { useLocalSearchParams } from 'expo-router'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import type { VersionCode } from '~state/tabs'

type PericopeVerse = {
  h1?: string
  h2?: string
  h3?: string
  h4?: string
  [key: string]: string | undefined
}
type PericopeChapter = Record<string, PericopeVerse>
type PericopeBook = Record<string, PericopeChapter>

const PericopeHeading = styled(Paragraph)<{ size: number }>(({ size }) => ({
  fontSize: size,
  marginLeft: 20,
  marginBottom: 20,
  fontWeight: 'bold',
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

/**
 * Recursively removes empty object branches from pericope data.
 * Note: this mutates the input object for performance on large pericope trees.
 */
function clearEmpties<T extends Record<string, unknown>>(o: T): T {
  for (const k in o) {
    if (!o[k] || typeof o[k] !== 'object') continue
    clearEmpties(o[k] as Record<string, unknown>)
    if (Object.keys(o[k] as Record<string, unknown>).length === 0) {
      delete o[k]
    }
  }
  return o
}

type PericopeScreenProps = {
  isFormSheet?: boolean
}

const PericopeScreen = ({ isFormSheet = false }: PericopeScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const canGoBackInStack = useCanGoBackInStack()
  const { t } = useTranslation()
  const defaultVersion = useDefaultBibleVersion()
  const params = useLocalSearchParams<{ book?: string; version?: string }>()
  const version = (params.version || defaultVersion) as VersionCode
  const hasBackButton = isFormSheet ? canGoBackInStack : true

  const initialBookIndex = params.book ? Number(params.book) - 1 : 0
  const [book, setBook] = useState(books[initialBookIndex] || books[0])

  const { data: pericope } = useQuery({
    queryKey: ['bible-pericope', version],
    queryFn: () => getBiblePericope(version),
  })
  const pericopeBook: PericopeBook = pericope
    ? clearEmpties((pericope[String(book.Numero)] || {}) as PericopeBook)
    : {}

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        <PericopeHeader hasBackButton={hasBackButton} title={`${t('Péricopes')} ${version}`} />
        <ScrollView>
          <Box padding={20}>
            <Text fontSize={30} fontWeight="bold" marginBottom={40}>
              {t(book.Nom)}
            </Text>
            {!Object.keys(pericopeBook).length ? (
              <Empty
                source={require('~assets/images/empty.json')}
                message={t('Aucun péricope pour ce Livre, essayez avec une autre version.')}
              />
            ) : (
              Object.entries(pericopeBook).map(([chapterKey, chapterObject]) => (
                <Fragment key={chapterKey}>
                  {!!Object.keys(chapterObject).length && (
                    <Text color="tertiary" fontSize={12} marginBottom={10}>
                      {t('CHAPITRE')} {chapterKey}
                    </Text>
                  )}
                  {Object.entries(chapterObject).map(([verseKey, verseObject]) => {
                    const { h1, h2, h3, h4 } = verseObject
                    return (
                      <TouchableOpacity
                        key={verseKey}
                        onPress={() =>
                          pushRouteOnce({
                            pathname: '/bible-view',
                            params: {
                              contextDisplayMode: 'focused',
                              book: JSON.stringify(book),
                              chapter: String(chapterKey),
                              version,
                              verse: '1',
                            },
                          })
                        }
                      >
                        {h1 && <PericopeHeading size={24}>{h1}</PericopeHeading>}
                        {h2 && <PericopeHeading size={20}>{h2}</PericopeHeading>}
                        {h3 && <PericopeHeading size={18}>{h3}</PericopeHeading>}
                        {h4 && <PericopeHeading size={16}>{h4}</PericopeHeading>}
                      </TouchableOpacity>
                    )
                  })}
                </Fragment>
              ))
            )}
          </Box>
        </ScrollView>
        <Box
          bg="reverse"
          row
          paddingHorizontal={20}
          paddingVertical={10}
          justifyContent="space-between"
        >
          {book.Numero !== 1 && (
            <Link onPress={() => setBook(books[book.Numero - 2])}>
              <StyledIcon name="arrow-left" size={30} />
            </Link>
          )}
          {book.Numero !== 66 && (
            <Link onPress={() => setBook(books[book.Numero])} style={{ marginLeft: 'auto' }}>
              <StyledIcon name="arrow-right" size={30} />
            </Link>
          )}
        </Box>
      </Box>
    </FormSheetScreen>
  )
}

export default PericopeScreen
