import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const color1 = '#ffd255'
  const color2 = '#ffbc00'

  return (
    <Link key={word} route="DictionnaryDetail" params={{ word }}>
      <Box
        className="overflow-hidden border-continuous items-center justify-center rounded-[8px] mr-[10px] mb-[10px] px-[10px]"
        style={{ height: height }}
      >
        <Box
          className="overflow-hidden border-continuous"
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
        <Box className="overflow-hidden border-continuous bg-[rgba(0,0,0,0.1)] px-[3px] py-[2px] rounded-[20px]">
          <Text className="text-[7px]" style={{ color: 'white' }}>
            Mot
          </Text>
        </Box>
        <Text
          className="text-[14px]"
          style={[
            { fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) },
            { color: 'white' },
          ]}
        >
          {word}
        </Text>
      </Box>
    </Link>
  )
}

export default DictionnaryResultItem
