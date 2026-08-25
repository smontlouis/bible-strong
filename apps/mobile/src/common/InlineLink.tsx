import React from 'react'
import { Linking } from 'react-native'
import Paragraph from '~common/ui/Paragraph'

interface InlineLinkProps {
  href: string
  children: React.ReactNode
  [key: string]: unknown
}

const InlineLink = ({ href, children, ...props }: InlineLinkProps) => {
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
