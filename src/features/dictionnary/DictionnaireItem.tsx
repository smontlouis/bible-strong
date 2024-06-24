import React, { memo } from 'react'
import styled from '@emotion/native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

type Props = {
  word: string
  navigation: StackNavigationProp<MainStackProps>
}

const SectionItem = styled(Box)(({ theme }) => ({
  height: 60,
  marginLeft: 20,
  marginRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))

const DictionnaireItem = memo(({ word, navigation }: Props) => (
  <Link route="DictionnaryDetail" navigation={navigation} params={{ word }}>
    <SectionItem>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {word}
        </Text>
      </Box>
    </SectionItem>
  </Link>
))

export default DictionnaireItem
