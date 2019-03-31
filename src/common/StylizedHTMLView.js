import React from 'react'
import { StyleSheet } from 'react-native'
import { pure } from 'recompose'

import HTMLView from '~helpers/react-native-htmlview'
import theme from '~themes/default'

const textStyle = {
  lineHeight: 27,
  fontSize: 18
}

const styles = StyleSheet.create({
  h1: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.black
  },
  h2: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.black
  },
  h3: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.black
  },
  p: {
    color: theme.colors.black,
    ...textStyle
  },
  em: {
    // fontStyle: 'italic',
    // color: '$color.primaryLighten',
    ...textStyle
  },
  a: {
    // fontWeight: 'bold',
    color: theme.colors.black,
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: theme.colors.primary,
    ...textStyle
  },
  strong: {
    fontWeight: 'bold',
    color: theme.colors.black,
    ...textStyle
  },
  li: {
    lineHeight: 18
  }
})

const StylizedHTMLView = ({ htmlStyle, ...props }) => (
  <HTMLView stylesheet={{ ...styles, ...htmlStyle }} {...props} />
)

export default pure(StylizedHTMLView)
