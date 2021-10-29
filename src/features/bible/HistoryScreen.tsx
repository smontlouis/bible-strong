import React from 'react'
import styled from '@emotion/native'
import { useDispatch, useSelector } from 'react-redux'
import distanceInWords from 'date-fns/formatDistance'
import * as Icon from '@expo/vector-icons'

import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'

import books from '~assets/bible_versions/books-desc'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import Header from '~common/Header'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Empty from '~common/Empty'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import { deleteHistory } from '~redux/modules/user'
import { useTranslation, Trans } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

const Chip = styled.View(({ theme, color }) => ({
  height: 15,
  alignSelf: 'flex-end',
  borderRadius: 7,
  backgroundColor: color ? theme.colors[color] : theme.colors.border,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 5,
  marginBottom: 5,
}))

const HistoryItem = ({ item }) => {
  const { t } = useTranslation()
  const isFR = useLanguage()

  if (item.type === 'strong') {
    const { Hebreu, Grec, Mot, date, book } = item
    const ago = distanceInWords(Number(date), Date.now(), {
      locale: isFR ? fr : enGB,
    })
    return (
      <Link route="BibleStrongDetail" params={{ book, strongReference: item }}>
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
      locale: isFR ? fr : enGB,
    })
    let { title } = formatVerseContent([
      { Livre: book, Chapitre: chapter, Verset: verse },
    ])
    if (title.endsWith(':1')) {
      title = title.substring(0, title.length - 2)
    }
    return (
      <Link
        route="BibleView"
        params={{
          isReadOnly: true,
          book: books[book - 1],
          chapter,
          verse,
          version,
        }}
      >
        <Box padding={20} row alignItems="center">
          <Text bold>
            {title} {version}
          </Text>
          <Box marginLeft="auto">
            <Chip>
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
      locale: isFR ? fr : enGB,
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
      locale: isFR ? fr : enGB,
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
  const { history, colors } = useSelector(state => ({
    history: state.user.bible.history,
    colors: state.user.bible.settings.colors[state.user.bible.settings.theme],
  }))
  const dispatch = useDispatch()
  const { t } = useTranslation()

  return (
    <Container>
      <Header
        hasBackButton
        title={t('Historique')}
        rightComponent={
          <Link onPress={() => dispatch(deleteHistory())} padding>
            <Icon.Feather size={20} name="trash-2" color={colors.quart} />
          </Link>
        }
      />
      <Box flex>
        {history.length ? (
          <FlatList
            removeClippedSubviews
            data={history}
            keyExtractor={item => item.date.toString()}
            renderItem={({ item }) => <HistoryItem item={item} />}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Historique vide..."
          />
        )}
      </Box>
    </Container>
  )
}

export default History
