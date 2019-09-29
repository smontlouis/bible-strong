import React from 'react'
import styled from '@emotion/native'
import { FlatList } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'

import books from '~assets/bible_versions/books-desc'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Empty from '~common/Empty'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import { deleteHistory } from '~redux/modules/user'

const Chip = styled.View(({ theme, color }) => ({
  height: 15,
  alignSelf: 'flex-end',
  borderRadius: 7,
  backgroundColor: color ? theme.colors[color] : theme.colors.border,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 5,
  marginBottom: 5
}))

const HistoryItem = ({ item }) => {
  if (item.type === 'strong') {
    const { Hebreu, Grec, Mot, date, book } = item
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
              Il y a{' '}
              {distanceInWords(Number(date), Date.now(), {
                locale: frLocale
              })}
            </Text>
          </Box>
        </Box>
        <Border />
      </Link>
    )
  }
  if (item.type === 'verse') {
    const { book, chapter, verse, version, date } = item
    let { title } = formatVerseContent([{ Livre: book, Chapitre: chapter, Verset: verse }])
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
          version
        }}>
        <Box padding={20} row alignItems="center">
          <Text bold>
            {title} {version}
          </Text>
          <Box marginLeft="auto">
            <Chip>
              <Text bold fontSize={8}>
                Verset
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              Il y a{' '}
              {distanceInWords(Number(date), Date.now(), {
                locale: frLocale
              })}
            </Text>
          </Box>
        </Box>
        <Border />
      </Link>
    )
  }
  if (item.type === 'word') {
    const { word, date } = item
    return (
      <Link route="DictionnaryDetail" params={{ word }}>
        <Box padding={20} row alignItems="center">
          <Text bold>{word}</Text>
          <Box marginLeft="auto">
            <Chip color="secondary">
              <Text bold fontSize={8}>
                Mot
              </Text>
            </Chip>
            <Text fontSize={10} color="grey">
              Il y a{' '}
              {distanceInWords(Number(date), Date.now(), {
                locale: frLocale
              })}
            </Text>
          </Box>
        </Box>
        <Border />
      </Link>
    )
  }
  return null
}

const History = () => {
  const { history, colors } = useSelector(state => ({
    history: state.user.bible.history,
    colors: state.user.bible.settings.colors[state.user.bible.settings.theme]
  }))
  const dispatch = useDispatch()

  return (
    <Container>
      <Header
        hasBackButton
        title="Historique"
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
          <Empty source={require('~assets/images/empty.json')} message="Historique vide..." />
        )}
      </Box>
    </Container>
  )
}

export default History
