import React from 'react'
import { Platform } from 'react-native'
import { Icon } from 'expo'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Back from '~common/Back'

const LinkBox = styled(Link)({
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 15,
  paddingVertical: 15
})

const Text = styled.Text({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5
})

const BibleParameters = styled.TouchableOpacity(({ theme }) => ({
  fontSize: 16,
  fontWeight: 'bold',
  marginLeft: 'auto',
  color: theme.colors.darkGrey
}))

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  width: theme.measures.maxWidth,
  marginLeft: 'auto',
  marginRight: 'auto'
}))

const Header = ({
  isReadOnly,
  noBorder,
  book,
  chapter,
  verse,
  version,
  onBibleParamsClick
}) => {
  if (isReadOnly) {
    return (
      <HeaderBox noBorder={noBorder} row>
        <Box flex justifyContent='center'>
          <Back underlayColor='transparent' style={{ marginRight: 15 }}>
            <Icon.Feather name={'arrow-left'} size={20} color='black' />
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
        <Icon.Feather name='chevron-down' size={15} />
      </LinkBox>
      <LinkBox route={'VersionSelector'} params={{ version }}>
        <Text>{version}</Text>
        <Icon.Feather name='chevron-down' size={15} />
      </LinkBox>
      <BibleParameters onPress={onBibleParamsClick}>
        <Text>
          Aa
        </Text>
      </BibleParameters>
    </HeaderBox>
  )
}

export default pure(Header)
