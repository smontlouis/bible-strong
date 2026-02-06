import { Fragment, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import books from '~assets/bible_versions/books-desc'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import PericopeHeader from './PericopeHeader'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import Empty from '~common/Empty'
import getBiblePericope from '~helpers/getBiblePericope'
import { useTranslation } from 'react-i18next'
import { useQuery } from '~helpers/react-query-lite'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'

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
function clearEmpties(o: any) {
  for (const k in o) {
    if (!o[k] || typeof o[k] !== 'object') continue
    clearEmpties(o[k])
    if (Object.keys(o[k]).length === 0) {
      delete o[k]
    }
  }
  return o
}

const PericopeScreen = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const defaultVersion = useDefaultBibleVersion()
  const params = useLocalSearchParams<{ book?: string }>()

  const initialBookIndex = params.book ? Number(params.book) - 1 : 0
  const [book, setBook] = useState(books[initialBookIndex] || books[0])

  const { data: pericope } = useQuery({
    queryKey: ['bible-pericope', defaultVersion],
    queryFn: () => getBiblePericope(defaultVersion),
  })
  const pericopeBook = pericope ? clearEmpties(pericope[book.Numero]) : {}

  return (
    <Container>
      <PericopeHeader hasBackButton title={`${t('Péricopes')} ${defaultVersion}`} />
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
            Object.entries(pericopeBook).map(([chapterKey, chapterObject]: any) => (
              <Fragment key={chapterKey}>
                {!!Object.keys(chapterObject).length && (
                  <Text color="tertiary" fontSize={12} marginBottom={10}>
                    {t('CHAPITRE')} {chapterKey}
                  </Text>
                )}
                {Object.entries(chapterObject).map(([verseKey, verseObject]: any) => {
                  const { h1, h2, h3, h4 } = verseObject
                  return (
                    <TouchableOpacity
                      key={verseKey}
                      onPress={() =>
                        router.push({
                          pathname: '/bible-view',
                          params: {
                            isReadOnly: 'true',
                            book: JSON.stringify(book),
                            chapter: String(chapterKey),
                            version: defaultVersion,
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
        {book.Numero != 1 && (
          <Link onPress={() => setBook(books[book.Numero - 2])}>
            <StyledIcon name="arrow-left" size={30} />
          </Link>
        )}
        {book.Numero != 66 && (
          <Link onPress={() => setBook(books[book.Numero])} style={{ marginLeft: 'auto' }}>
            <StyledIcon name="arrow-right" size={30} />
          </Link>
        )}
      </Box>
    </Container>
  )
}

export default PericopeScreen
