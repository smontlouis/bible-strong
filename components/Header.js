import React from 'react'
import { View } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import Box from '@ui/Box'
import Link from '@components/Link'

const LinkBox = styled(Link)({
  flexDirection: 'row',
  paddingLeft: 15
})

const Text = styled.Text({
  fontSize: 20
})

const Header = ({ navigation, book, chapter, version }) => {
  const { routeName } = navigation.state.routes[navigation.state.index]

  if (routeName === 'Home') {
    return (
      <Box flex row height='100%' alignItems='center'>
        <LinkBox route={'BibleSelect'}>
          <Text>
            {book.Nom} {chapter}
          </Text>
          <Icon name='arrow-drop-down' size={20} />
        </LinkBox>
        <LinkBox route={'versionSelector'} params={{ version }}>
          <Text>{version}</Text>
          <Icon name='arrow-drop-down' size={20} />
        </LinkBox>
      </Box>
    )
  }

  return (
    <View
      style={{
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Text>{routeName}</Text>
    </View>
  )
}

export default compose(
  connect(({ bible }) => ({
    book: bible.selectedBook,
    chapter: bible.selectedChapter,
    version: bible.selectedVersion
  })),
  pure
)(Header)
