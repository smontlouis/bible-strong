import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { Pressable } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { LinearGradient } from 'expo-linear-gradient'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { createStrongIdentityForBook } from '~helpers/strongIdentities'
import { createStrongDetailRoute } from './strongDetailRoutes'
const height = 40

interface Props {
  variant: 'grec' | 'hebreu'
  displayCode: string
  reference: string
  title: string
}
const LexiqueResultItem = ({ variant, displayCode, reference, title }: Props) => {
  const stylingTheme = useStylingTheme()
  const pushRouteOnce = usePushRouteOnce()

  const isGrec = variant === 'grec'

  const color1 = isGrec ? 'rgb(69,150,220)' : 'rgba(248,131,121,1)'
  const color2 = isGrec ? 'rgb(89,131,240)' : 'rgba(255,77,93,1)'
  const openStrong = () => {
    const book = isGrec ? 40 : 1
    const identity = createStrongIdentityForBook(reference, book)
    pushRouteOnce(
      createStrongDetailRoute('index', {
        book,
        reference: identity.code,
        identityKind: identity.kind,
        identityCode: identity.code,
      })
    )
  }

  return (
    <Pressable
      key={reference + title}
      accessibilityRole="link"
      onPress={openStrong}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Box
        className="overflow-hidden border-continuous items-center justify-center rounded-[8px] mr-[10px] mb-[10px] px-[20px]"
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
            {displayCode} {isGrec ? 'Grec' : 'Hébreu'}
          </Text>
        </Box>
        <Text
          className="text-[14px]"
          style={[
            { fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) },
            { color: 'white' },
          ]}
        >
          {title}
        </Text>
      </Box>
    </Pressable>
  )
}

export default LexiqueResultItem
