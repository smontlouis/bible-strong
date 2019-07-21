import React from 'react'
import { withTheme } from 'emotion-theming'

import HTMLView from '~helpers/react-native-htmlview'

const textStyle = {
  lineHeight: 27,
  fontSize: 18
}

const styles = (theme) => ({
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
    // fontStyle: 'italic',
    // color: '$color.primaryLighten',
    ...textStyle
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
    lineHeight: 18,
    color: theme.colors.default
  },
  ol: {
    color: theme.colors.default
  },
  ul: {
    color: theme.colors.default
  }

})

const StylizedHTMLView = ({ htmlStyle, theme, ...props }) => (
  <HTMLView stylesheet={{ ...styles(theme), ...htmlStyle }} {...props} />
)

export default withTheme(StylizedHTMLView)
