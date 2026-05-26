import React from 'react'
import Box, { BoxProps } from './Box'
import Container from './Container'

type Props = BoxProps & {
  isFormSheet?: boolean
  children: React.ReactNode
}

const FormSheetScreen = ({ isFormSheet = false, children, ...props }: Props) => {
  if (isFormSheet) {
    return <>{children}</>
  }

  return <Container {...props}>{children}</Container>
}

export default FormSheetScreen
