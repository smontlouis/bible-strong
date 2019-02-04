import React from 'react'
import { Platform } from 'react-native'
import { Icon } from 'expo'
import { pure } from 'recompose'
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

const Header = ({ isReadOnly, noBorder, book, chapter, verse, version }) => {
  if (isReadOnly) {
    return (
      <HeaderBox noBorder={noBorder} row>
        <Box flex justifyContent='center'>
          <Back underlayColor='transparent' style={{ marginRight: 15 }}>
            <Icon.AntDesign name={'arrowleft'} size={20} color='black' />
          </Back>
        </Box>
        <Box grow center>
          <Text>
            {book.Nom} {chapter}:{verse} - {version}
          </Text>
        </Box>
        <Box flex />
      </HeaderBox>
    )
  }
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

export default pure(Header)
