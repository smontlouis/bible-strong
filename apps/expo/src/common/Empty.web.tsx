import { useTheme } from '~themes/ThemeProvider'
import { Image, type ImageSource } from 'expo-image'
import type { ReactNode } from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
type Props = {
  message: string
  source?: unknown
  icon?: ImageSource
  iconElement?: ReactNode
  children?: ReactNode
}

const Empty = ({ message, icon, iconElement, children }: Props) => {
  const theme = useTheme()

  return (
    <Box className="overflow-hidden border-continuous flex-[1] items-center">
      <Box className="overflow-hidden border-continuous items-center justify-center flex-[1] px-[20px]">
        {icon && (
          <Box className="overflow-hidden border-continuous mb-[20px]">
            <Image
              source={icon}
              style={{ width: 80, height: 80, opacity: 0.6 }}
              tintColor={theme.colors.tertiary}
              contentFit="contain"
            />
          </Box>
        )}
        {iconElement && !icon && (
          <Box className="overflow-hidden border-continuous mb-[20px]">{iconElement}</Box>
        )}
        {message && <Text className="text-center text-tertiary">{message}</Text>}
        {children}
      </Box>
    </Box>
  )
}

export default Empty
