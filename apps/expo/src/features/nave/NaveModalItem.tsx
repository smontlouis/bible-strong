import React from 'react'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'

type NaveModalItemProps = {
  item: {
    name: string
    name_lower: string
  }
}

const NaveItem = ({ item: { name, name_lower } }: NaveModalItemProps) => {
  return (
    <Link route="NaveDetail" params={{ name, name_lower }}>
      <Box borderRadius={5} bg="quint" bgOpacity="010" px={12} py={5}>
        <Text color="quint" title fontSize={14}>
          {name}
        </Text>
      </Box>
    </Link>
  )
}

export default NaveItem
