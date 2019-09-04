import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Back from '~common/Back'

const LinkBox = styled(Link)({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 10,
  paddingRight: 10,
  paddingVertical: 15
})

const StyledText = styled(Text)({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5
})

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const MaterialCommunityIcon = styled(Icon.MaterialIcons)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({
  isReadOnly,
  isSelectionMode,
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
        <Box flex justifyContent="center">
          <Back padding>
            <StyledIcon name="arrow-left" size={20} />
          </Back>
        </Box>
        <Box grow center>
          <StyledText>
            {book.Nom} {chapter}:{verse} - {version}
          </StyledText>
        </Box>
        <Box flex />
      </HeaderBox>
    )
  }
  return (
    <HeaderBox noBorder={noBorder} row>
      {isSelectionMode && (
        <Box justifyContent="center">
          <Back padding>
            <StyledIcon name="arrow-left" size={20} />
          </Back>
        </Box>
      )}
      <LinkBox route="BibleSelect" style={{ paddingLeft: 15 }}>
        <StyledText>
          {book.Nom} {chapter}
        </StyledText>
        <StyledIcon name="chevron-down" size={15} />
      </LinkBox>
      <LinkBox route="VersionSelector" params={{ version }}>
        <StyledText>{version}</StyledText>
        <StyledIcon name="chevron-down" size={15} />
      </LinkBox>
      <LinkBox route="Pericope" style={{ width: 50 }}>
        <MaterialCommunityIcon name="subtitles" size={20} />
      </LinkBox>

      {!isSelectionMode && (
        <LinkBox
          onPress={onBibleParamsClick}
          style={{
            marginLeft: 'auto',
            width: 50,
            justifyContent: 'center',
            alignItems: 'center',
            paddingLeft: 0,
            paddingRight: 0
          }}>
          <StyledText>Aa</StyledText>
        </LinkBox>
      )}
    </HeaderBox>
  )
}

export default pure(Header)
