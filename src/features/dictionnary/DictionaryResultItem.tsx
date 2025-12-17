import React from 'react'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'

const height = 40

interface Props {
  word: string
}
const DictionnaryResultItem = ({ word }: Props) => {
  const color1 = '#ffd255'
  const color2 = '#ffbc00'

  return (
    <Link key={word} route="DictionnaryDetail" params={{ word }}>
      <Box center rounded marginRight={10} marginBottom={10} height={height} paddingHorizontal={10}>
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
            Mot
          </Text>
        </Box>
        <Text title fontSize={14} style={{ color: 'white' }}>
          {word}
        </Text>
      </Box>
    </Link>
  )
}

export default DictionnaryResultItem
