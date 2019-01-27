import React from 'react'
import { Platform } from 'react-native'
import { Icon } from 'expo'
import { pure, compose } from 'recompose'
import { connect } from 'react-redux'
import styled from '@emotion/native'

import Box from '@ui/Box'
import Link from '@components/Link'
import Back from '@components/Back'

const LinkBox = styled(Link)({
  flexDirection: 'row',
  paddingRight: 15
})

const Text = styled.Text({
  fontSize: 16,
  fontWeight: 'bold'
})

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: 15,
  paddingRight: 15
}))

const Header = ({
  navigation,
  hasBackButton,
  isBible,
  isModal,
  title,
  noBorder,
  book,
  chapter,
  version
}) => {
  if (isBible) {
    return (
      <HeaderBox noBorder={noBorder} row>
        <LinkBox route={'BibleSelect'}>
          <Text>
            {book.Nom} {chapter}
          </Text>
          <Icon.MaterialIcons name='arrow-drop-down' size={20} />
        </LinkBox>
        <LinkBox route={'VersionSelector'} params={{ version }}>
          <Text>{version}</Text>
          <Icon.MaterialIcons name='arrow-drop-down' size={20} />
        </LinkBox>
      </HeaderBox>
    )
  }

  return (
    <HeaderBox noBorder={noBorder} row>
      <Box flex justifyContent='center'>
        {hasBackButton && (
          <Back underlayColor='transparent' style={{ marginRight: 15 }}>
            <Icon.AntDesign
              name={isModal ? 'close' : 'arrowleft'}
              size={isModal ? 20 : 20}
              color='black'
            />
          </Back>
        )}
      </Box>
      <Box flex={2} center>
        <Text>{title}</Text>
      </Box>
      <Box flex />
    </HeaderBox>
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
