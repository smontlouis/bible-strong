import React from 'react'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'

const height = 40

interface Props {
  name_lower: string
  name: string
}
const NaveResultItem = ({ name_lower, name }: Props) => {
  const color1 = 'rgb(80, 83, 140)'
  const color2 = 'rgb(48, 51, 107)'

  return (
    <Link key={name_lower} route="NaveDetail" params={{ name_lower, name }}>
      <Box
        center
        borderRadius={8}
        marginRight={10}
        marginBottom={10}
        height={height}
        paddingHorizontal={10}
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height,
            borderRadius: 3,
          }}
        >
          <LinearGradient start={[0.1, 0.2]} style={{ height }} colors={[color1, color2]} />
        </Box>
        <Box backgroundColor="rgba(0,0,0,0.1)" paddingHorizontal={3} paddingVertical={2} rounded>
          <Text fontSize={7} style={{ color: 'white' }}>
            Nave
          </Text>
        </Box>
        <Text title fontSize={14} style={{ color: 'white' }}>
          {name}
        </Text>
      </Box>
    </Link>
  )
}

export default NaveResultItem
