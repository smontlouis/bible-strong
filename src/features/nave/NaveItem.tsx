import React, { memo } from 'react'
import styled from '@emotion/native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

type Props = {
  name_lower: string
  name: string
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

const DictionnaireItem = memo(({ name_lower, name, navigation }: Props) => (
  <Link route="NaveDetail" navigation={navigation} params={{ name_lower, name }}>
    <SectionItem>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {name}
        </Text>
      </Box>
    </SectionItem>
  </Link>
))

export default DictionnaireItem
