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
    <Box
      className="overflow-hidden border-continuous absolute top-[4px] left-[0px] right-[0px] items-center justify-center"
      style={{ height: FORM_SHEET_GRABBER_HEIGHT }}
    >
      <Box
        className="overflow-hidden border-continuous w-[38px] h-[5px] rounded-[20px] bg-default"
        style={{ opacity: 0.5 }}
      />
    </Box>
  )
}

export default FormSheetScreen
