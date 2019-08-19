import React from 'react'
import { withTheme } from 'emotion-theming'

import HTMLView from '~helpers/react-native-htmlview'

const textStyle = {
  lineHeight: 34,
  fontSize: 20,
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
    color: theme.colors.default,
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
    color: theme.colors.default,
    ...textStyle
  },
  li: {
    color: theme.colors.default,
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

const StylizedHTMLView = ({ htmlStyle, theme, ...props }) => (
  <HTMLView stylesheet={{ ...styles(theme), ...htmlStyle }} {...props} />
)

export default withTheme(StylizedHTMLView)
