import React from 'react'
import { withTheme } from 'emotion-theming'

import HTMLView from '~helpers/react-native-htmlview'

export const textStyle = {
  lineHeight: 26,
  fontSize: 18,
  fontFamily: 'literata-book'
}

const styles = theme => ({
  h1: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default
  },
  h2: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default
  },
  h3: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default
  },
  p: {
    color: theme.colors.default,
    ...textStyle
  },
  em: {
    // color: '$color.primaryLighten',
    ...textStyle,
    color: theme.colors.tertiary,
    fontStyle: 'italic',
    fontWeight: 'bold'
  },
  a: {
    // fontWeight: 'bold',
    color: theme.colors.primary,
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: theme.colors.primary,
    ...textStyle,
    fontSize: 18
  },
  strong: {
    fontWeight: 'bold',
    color: theme.colors.default,
    ...textStyle
  },
  li: {
    color: theme.colors.default,
    marginBottom: 40,
    ...textStyle
  },
  ol: {
    color: theme.colors.default,
    ...textStyle
  },
  ul: {
    color: theme.colors.default,
    ...textStyle
  }
})

const NaveHTMLView = ({ htmlStyle, theme, ...props }) => (
  <HTMLView stylesheet={{ ...styles(theme), ...htmlStyle }} {...props} />
)

export default withTheme(NaveHTMLView)
