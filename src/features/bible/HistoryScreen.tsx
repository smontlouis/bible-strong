import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import React from 'react'

import { useAtomValue, useSetAtom } from 'jotai/react'
import { Trans, useTranslation } from 'react-i18next'
import { getBook } from '~helpers/bibleBookCatalog'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { StrongReference } from '~common/types'
import formatVerseContent from '~helpers/formatVerseContent'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import {
  deleteHistoryAtom,
  historyAtom,
  type HistoryItem as HistoryItemType,
} from '../../state/app'
import { VersionCode } from '~state/tabs'

const Chip = styled.View<{ color: string }>(({ theme, color }) => ({
  height: 15,
  alignSelf: 'flex-end',
  borderRadius: 7,
  backgroundColor: theme.colors[color as keyof typeof theme.colors] || color || theme.colors.border,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 5,
  marginBottom: 5,
}))

const HistoryItem = ({ item }: { item: HistoryItemType }) => {
  const { t } = useTranslation()
  const lang = useLanguage()

  if (item.type === 'strong') {
    const { Hebreu, Grec, Mot, date, book } = item
    const ago = distanceInWords(Number(date), Date.now(), {
      locale: getDateLocale(lang),
    })
    return (
      <Link route="Strong" params={{ book, strongReference: item as unknown as StrongReference }}>
        <Box padding={20} row alignItems="center">
          <Box>
            <Text bold>{Mot}</Text>
            <Text marginTop={5} color="grey" fontSize={12}>
              {Grec || Hebreu}
            </Text>
          </Box>
          <Box marginLeft="auto">
            <Chip color="primary">
              <Text bold fontSize={8} color="reverse">
                Strong
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border marginHorizontal={20} />
      </Link>
    )
  }
  if (item.type === 'verse') {
    const { book, chapter, verse, version, date } = item
    const ago = distanceInWords(Number(date), Date.now(), {
      locale: getDateLocale(lang),
    })
    const bookNumber = Number(book)
    const chapterNumber = Number(chapter)
    const verseNumber = Number(verse)
    let { title } = formatVerseContent([
      { Livre: bookNumber, Chapitre: chapterNumber, Verset: verseNumber },
    ])
    if (title.endsWith(':1')) {
      title = title.substring(0, title.length - 2)
    }
    return (
      <Link
        route="BibleView"
        params={{
          contextDisplayMode: 'focused',
          book: getBook(bookNumber) || getBook(1)!,
          chapter: chapterNumber,
          verse: verseNumber,
          version: version as VersionCode,
        }}
      >
        <Box padding={20} row alignItems="center">
          <Text bold>
            {title} {version}
          </Text>
          <Box marginLeft="auto">
            <Chip color="border">
              <Text bold fontSize={8}>
                {t('Verset')}
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border marginHorizontal={20} />
      </Link>
    )
  }
  if (item.type === 'word') {
    const { word, date } = item
    const ago = distanceInWords(Number(date), Date.now(), {
      locale: getDateLocale(lang),
    })
    return (
      <Link route="DictionnaryDetail" params={{ word }}>
        <Box padding={20} row alignItems="center">
          <Text bold>{word}</Text>
          <Box marginLeft="auto">
            <Chip color="secondary">
              <Text bold fontSize={8}>
                {t('Mot')}
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border marginHorizontal={20} />
      </Link>
    )
  }

  if (item.type === 'nave') {
    const { name, name_lower, date } = item
    const ago = distanceInWords(Number(date), Date.now(), {
      locale: getDateLocale(lang),
    })
    return (
      <Link route="NaveDetail" params={{ name, name_lower }}>
        <Box padding={20} row alignItems="center">
          <Text bold>{name}</Text>
          <Box marginLeft="auto">
            <Chip color="quint">
              <Text bold fontSize={8} color="white">
                {t('Nave')}
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border marginHorizontal={20} />
      </Link>
    )
  }
  return null
}

const History = () => {
  const history = useAtomValue(historyAtom)
  const deleteHistory = useSetAtom(deleteHistoryAtom)
  const { t } = useTranslation()

  return (
    <Container>
      <Header
        hasBackButton
        title={t('Historique')}
        rightComponent={
          <Link onPress={deleteHistory} padding>
            <FeatherIcon size={20} name="trash-2" color="quart" />
          </Link>
        }
      />
      <Box flex>
        {history.length ? (
          <FlatList
            removeClippedSubviews
            data={history}
            keyExtractor={(item: HistoryItemType) => item.date.toString()}
            renderItem={({ item }: { item: HistoryItemType }) => <HistoryItem item={item} />}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/history.svg')}
            message="Historique vide..."
          />
        )}
      </Box>
    </Container>
  )
}

export default History
