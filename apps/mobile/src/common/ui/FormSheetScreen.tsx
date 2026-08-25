import React from 'react'
import { Platform } from 'react-native'
import { FORM_SHEET_GRABBER_HEIGHT } from '~features/app-switcher/utils/constants'
import Box, { BoxProps } from './Box'
import Container from './Container'

type Props = BoxProps & {
  isFormSheet?: boolean
  children: React.ReactNode
}

const FormSheetScreen = ({ isFormSheet = false, children, ...props }: Props) => {
  if (isFormSheet) {
    return (
      <>
        <FormSheetHandle />
        {children}
      </>
    )
  }

  return <Container {...props}>{children}</Container>
}

export const FormSheetHandle = () => {
  // Disable handle for now
  return null

  if (Platform.OS === 'ios') {
    return null
  }
  return (
    <Box height={FORM_SHEET_GRABBER_HEIGHT} center position="absolute" top={4} left={0} right={0}>
      <Box height={5} width={38} bg="default" opacity={0.5} borderRadius={20} />
    </Box>
  )
}

export default FormSheetScreen
