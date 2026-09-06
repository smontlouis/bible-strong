import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const color1 = 'rgb(80, 83, 140)'
  const color2 = 'rgb(48, 51, 107)'

  return (
    <Link key={name_lower} route="NaveDetail" params={{ name_lower, name }}>
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
            Nave
          </Text>
        </Box>
        <Text
          className="text-[14px]"
          style={[
            { fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) },
            { color: 'white' },
          ]}
        >
          {name}
        </Text>
      </Box>
    </Link>
  )
}

export default NaveResultItem
