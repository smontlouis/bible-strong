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
      onPress={() => Linking.openURL(href)}
      fontFamily="text"
      {...props}
      className="text-primary font-bold"
    >
      {children}
    </Paragraph>
  )
}

export default InlineLink
