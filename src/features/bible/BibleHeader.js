import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import truncate from '~helpers/truncate'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Back from '~common/Back'
import useDimensions from '~helpers/useDimensions'

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
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400

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
      <LinkBox route="BibleSelect" style={{ paddingLeft: 15, paddingRight: 0 }}>
        <StyledText>
          {isSmall ? truncate(`${book.Nom} ${chapter}`, 10) : `${book.Nom} ${chapter}`}
        </StyledText>
        <StyledIcon name="chevron-down" size={15} />
      </LinkBox>
      <LinkBox route="VersionSelector" params={{ version }} style={{ paddingRight: 0 }}>
        <StyledText>{version}</StyledText>
        <StyledIcon name="chevron-down" size={15} />
      </LinkBox>
      <LinkBox route="Pericope" style={{ width: 40 }}>
        <MaterialCommunityIcon name="subtitles" size={20} />
      </LinkBox>

      <LinkBox route="History" style={{ width: 40, marginLeft: 'auto' }}>
        <MaterialCommunityIcon name="history" size={20} />
      </LinkBox>
      {!isSelectionMode && (
        <LinkBox
          onPress={onBibleParamsClick}
          style={{
            width: 40,
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
