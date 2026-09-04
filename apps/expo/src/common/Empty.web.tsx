import { useTheme } from '@emotion/react'
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
    <Box flex alignItems="center">
      <Box alignItems="center" justifyContent="center" flex px={20}>
        {icon && (
          <Box mb={20}>
            <Image
              source={icon}
              style={{ width: 80, height: 80, opacity: 0.6 }}
              tintColor={theme.colors.tertiary}
              contentFit="contain"
            />
          </Box>
        )}
        {iconElement && !icon && <Box mb={20}>{iconElement}</Box>}
        {message && (
          <Text textAlign="center" color="tertiary">
            {message}
          </Text>
        )}
        {children}
      </Box>
    </Box>
  )
}

export default Empty
