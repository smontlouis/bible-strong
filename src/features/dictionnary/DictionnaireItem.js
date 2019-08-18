import React, { memo } from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const SectionItem = styled(Box)(({ theme }) => ({
  height: 80,
  paddingLeft: 20,
  paddingRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center'
}))

const DictionnaireItem = memo(({ word }) => (
  <SectionItem>
    <Box row>
      <Text title fontSize={18} color="default" flex paddingRight={20}>
        {word}
      </Text>
    </Box>
  </SectionItem>
))

export default DictionnaireItem
