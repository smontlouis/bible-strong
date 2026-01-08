import React from 'react'
import { MAX_WIDTH } from '~helpers/useDimensions'
import Back from './Back'
import Box from './ui/Box'
import { FeatherIcon } from './ui/Icon'
import Text from './ui/Text'

export interface DetailedHeaderProps {
  hasBackButton?: boolean
  title: string
  subtitle?: string
  detail?: string
  rightComponent?: React.ReactNode
  borderColor?: string
}

const DetailedHeader = ({
  hasBackButton,
  title,
  subtitle,
  detail,
  rightComponent,
  borderColor = 'primary',
}: DetailedHeaderProps) => {
  return (
    <Box maxWidth={MAX_WIDTH} marginLeft="auto" marginRight="auto" row>
      {hasBackButton && (
        <Back padding>
          <FeatherIcon name={'arrow-left'} size={20} />
        </Back>
      )}
      <Box flex marginTop={-5} paddingVertical={20} paddingLeft={hasBackButton ? 0 : 20}>
        <Text title fontSize={22}>
          {title}
          {!!detail && (
            <Text title color="darkGrey" fontSize={16}>
              {' '}
              {detail}
            </Text>
          )}
        </Text>
        {!!subtitle && (
          // @ts-ignore
          <Text titleItalic color="darkGrey">
            {subtitle}
          </Text>
        )}
        <Box marginTop={10} width={35} height={3} backgroundColor={borderColor} />
      </Box>
      {rightComponent ? (
        <Box justifyContent="center" alignItems="flex-end" overflow="visible">
          {rightComponent}
        </Box>
      ) : (
        <Box width={60} />
      )}
    </Box>
  )
}

export default DetailedHeader
