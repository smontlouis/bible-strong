import React from 'react'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import * as Animatable from 'react-native-animatable'
import GlobalStateContext from '~helpers/globalContext'
import truncate from '~helpers/truncate'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Back from '~common/Back'
import useDimensions from '~helpers/useDimensions'

const LinkBox = styled(Link)(() => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 10,
  paddingRight: 10
}))

const StyledText = styled(Animatable.Text)(({ theme }) => ({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5,
  color: theme.colors.default
}))

const HeaderBox = styled(Box)(({ theme }) => ({
  maxWidth: 830,
  width: '100%',
  alignSelf: 'center',
  alignItems: 'stretch',
  borderBottomColor: theme.colors.border
}))

const AnimatableHeaderBox = Animatable.createAnimatableComponent(HeaderBox)

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const MaterialCommunityIcon = styled(Icon.MaterialIcons)(({ theme }) => ({
  color: theme.colors.default
}))

const AMaterialCommunityIcon = Animatable.createAnimatableComponent(
  MaterialCommunityIcon
)

const formatVerses = verses =>
  verses.reduce((acc, v, i, array) => {
    if (v === array[i - 1] + 1 && v === array[i + 1] - 1) {
      // if suite > 2
      return acc
    }
    if (v === array[i - 1] + 1 && v !== array[i + 1] - 1) {
      // if endSuite
      return `${acc}-${v}`
    }
    if (array[i - 1] && v - 1 !== array[i - 1]) {
      // if not preceded by - 1
      return `${acc},${v}`
    }
    return acc + v
  }, '')

const Header = ({
  isReadOnly,
  isSelectionMode,
  hasBackButton,
  book,
  chapter,
  verse,
  focusVerses,
  version,
  onBibleParamsClick
}) => {
  const dimensions = useDimensions()
  const isSmall = dimensions.screen.width < 400

  const {
    state: { isFullscreen },
    updateState
  } = React.useContext(GlobalStateContext)

  if (isReadOnly) {
    return (
      <HeaderBox row>
        <Box flex justifyContent="center">
          <Back padding>
            <StyledIcon name="arrow-left" size={20} />
          </Back>
        </Box>
        <Box grow center>
          <StyledText>
            {book.Nom} {chapter}:
            {focusVerses ? formatVerses(focusVerses) : verse} - {version}
          </StyledText>
        </Box>
        <Box flex />
      </HeaderBox>
    )
  }
  return (
    <AnimatableHeaderBox
      row
      transition="height"
      style={{ height: isFullscreen ? 25 : 60 }}
    >
      {(isSelectionMode || hasBackButton) && (
        <Box justifyContent="center">
          <Back padding>
            <StyledIcon name="arrow-left" size={20} />
          </Back>
        </Box>
      )}
      <LinkBox route="BibleSelect" style={{ paddingLeft: 15, paddingRight: 0 }}>
        <StyledText>
          {isSmall
            ? truncate(`${book.Nom} ${chapter}`, 10)
            : `${book.Nom} ${chapter}`}
        </StyledText>
      </LinkBox>
      <LinkBox
        route="VersionSelector"
        params={{ version }}
        style={{ paddingRight: 0 }}
      >
        <StyledText>{version}</StyledText>
      </LinkBox>
      <LinkBox
        onPress={() => updateState('isFullscreen', !isFullscreen)}
        style={{ width: 50 }}
      >
        <MaterialCommunityIcon
          name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
          size={20}
        />
      </LinkBox>
      {/* <LinkBox route="Pericope" style={{ width: 50 }}>
        <MaterialCommunityIcon name="subtitles" size={20} />
      </LinkBox> */}

      <LinkBox
        route="History"
        style={{
          width: 50,
          marginLeft: 'auto'
        }}
      >
        <AMaterialCommunityIcon
          style={{
            opacity: isFullscreen ? 0 : 1
          }}
          transition="opacity"
          name="history"
          size={20}
        />
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
          }}
        >
          <StyledText
            style={{
              opacity: isFullscreen ? 0 : 1
            }}
            transition="opacity"
          >
            Aa
          </StyledText>
        </LinkBox>
      )}
    </AnimatableHeaderBox>
  )
}

export default pure(Header)
