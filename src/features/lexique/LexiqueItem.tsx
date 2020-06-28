import React, { memo } from 'react'
import styled from '@emotion/native'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const SectionItem = styled(Box)(({ theme }) => ({
  height: 80,
  marginLeft: 20,
  marginRight: 20,
  backgroundColor: theme.colors.reverse,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))

const Chip = styled(Box)(({ theme, isHebreu }) => ({
  borderRadius: 10,
  backgroundColor: isHebreu ? theme.colors.lightPrimary : theme.colors.border,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 5,
  paddingRight: 5,
  marginBottom: 3,
}))

const LexiqueItem = memo(({ Mot, Grec, Hebreu, Code, lexiqueType }) => (
  // That's why : `const part = book > 39 ? 'LSGSNT2' : 'LSGSAT2'` - Ok this is not the best implementation
  <Link
    route="BibleStrongDetail"
    params={{ book: lexiqueType === 'Hébreu' ? 1 : 40, reference: Code }}
  >
    <SectionItem>
      <Box row>
        <Chip isHebreu={lexiqueType === 'Hébreu'}>
          <Text fontSize={10}>{lexiqueType}</Text>
        </Chip>
        <Chip marginLeft={5}>
          <Text fontSize={10}>{Code}</Text>
        </Chip>
      </Box>
      <Box row>
        <Text title fontSize={18} color="default" flex paddingRight={20}>
          {Mot}
        </Text>
        <Text fontSize={18} color="default">
          {Grec || Hebreu}
        </Text>
      </Box>
    </SectionItem>
  </Link>
))

export default LexiqueItem
