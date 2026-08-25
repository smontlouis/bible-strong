import React from 'react'
import styled from '@emotion/native'
import Color from 'color'

import Link from '~common/Link'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'

const StyledNaveItem = styled(Box)(({ theme }) => ({
  borderRadius: 5,
  backgroundColor: Color(theme.colors.quint).alpha(0.2).lighten(0.5).string(),
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 12,
  paddingRight: 12,
  marginRight: 5,
  marginBottom: 5,
}))

type NaveModalItemProps = {
  item: {
    name: string
    name_lower: string
  }
}

const NaveItem = ({ item: { name, name_lower } }: NaveModalItemProps) => {
  return (
    <Link route="NaveDetail" params={{ name, name_lower }}>
      <StyledNaveItem marginBottom={30}>
        <Text color="quint" title fontSize={14}>
          {name}
        </Text>
      </StyledNaveItem>
    </Link>
  )
}

export default NaveItem
