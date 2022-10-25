import React from 'react'
import { Linking } from 'react-native'
import Paragraph from '~common/ui/Paragraph'

const InlineLink = ({ href, children, ...props }) => {
  return (
    <Paragraph
      color="primary"
      onPress={() => Linking.openURL(href)}
      bold
      fontFamily="text"
      {...props}
    >
      {children}
    </Paragraph>
  )
}

export default InlineLink
