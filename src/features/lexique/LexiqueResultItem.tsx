import React from 'react'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'

const height = 40

interface Props {
  variant: 'grec' | 'hebreu'
  id: string
  title: string
}
const LexiqueResultItem = ({ variant, id, title }: Props) => {
  const isGrec = variant === 'grec'

  const color1 = isGrec ? 'rgb(69,150,220)' : 'rgba(248,131,121,1)'
  const color2 = isGrec ? 'rgb(89,131,240)' : 'rgba(255,77,93,1)'

  return (
    <Link
      key={id + title}
      route="BibleStrongDetail"
      params={{ book: isGrec ? 40 : 1, reference: id }}
    >
      <Box
        center
        rounded
        marginRight={10}
        marginBottom={10}
        height={height}
        paddingHorizontal={20}
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
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height }}
            colors={[color1, color2]}
          />
        </Box>
        <Box
          backgroundColor="rgba(0,0,0,0.1)"
          paddingHorizontal={3}
          paddingVertical={2}
          rounded
        >
          <Text fontSize={7} style={{ color: 'white' }}>
            {id} {isGrec ? 'Grec' : 'Hébreu'}
          </Text>
        </Box>
        <Text title fontSize={14} style={{ color: 'white' }}>
          {title}
        </Text>
      </Box>
    </Link>
  )
}

export default LexiqueResultItem
