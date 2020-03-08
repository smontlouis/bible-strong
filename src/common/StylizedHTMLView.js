import React from 'react'
import { withTheme } from 'emotion-theming'

import HTMLView from '~helpers/react-native-htmlview'

export const textStyle = {
  lineHeight: 29,
  fontSize: 19
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
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph
  },
  em: {
    // color: '$color.primaryLighten',
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
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
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle
  },
  strong: {
    fontWeight: 'bold',
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle
  },
  li: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle
  },
  ol: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle
  },
  ul: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle
  }
})

const StylizedHTMLView = ({ htmlStyle, theme, ...props }) => (
  <HTMLView stylesheet={{ ...styles(theme), ...htmlStyle }} {...props} />
)

export default withTheme(StylizedHTMLView)
