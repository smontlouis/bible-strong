import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import { versions } from '~helpers/bibleVersions'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Back from '~common/Back'

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const getPrevNextVersions = (versionsArray, version) => {
  const index = versionsArray.findIndex(v => v === version)
  return [versionsArray[index - 1], versionsArray[index + 1]]
}

const Header = ({ hasBackButton, isModal, title, onTitlePress, noBorder, version, setVersion }) => {
  const versionsArray = Object.keys(versions)
  const [prevVersion, nextVersion] = getPrevNextVersions(versionsArray, version)
  return (
    <HeaderBox noBorder={noBorder} row overflow="visibility">
      <Box justifyContent="center">
        {hasBackButton && (
          <Back padding>
            <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
          </Back>
        )}
      </Box>
      <Box center row flex>
        <Box center width={50}>
          {prevVersion && (
            <Text color="tertiary" fontSize={12} onPress={() => setVersion(prevVersion)} bold>
              {prevVersion}
            </Text>
          )}
        </Box>
        <Text fontSize={16} onPress={onTitlePress} bold marginLeft={10} marginRight={10}>
          {title}
        </Text>
        <Box center width={50}>
          {nextVersion && (
            <Text color="tertiary" fontSize={12} onPress={() => setVersion(nextVersion)} bold>
              {nextVersion}
            </Text>
          )}
        </Box>
      </Box>

      <Box width={30} />
    </HeaderBox>
  )
}

export default pure(Header)
