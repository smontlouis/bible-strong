import React from 'react'
import { withTheme } from 'emotion-theming'
import { Text } from 'react-native'

import HTMLView from '~helpers/react-native-htmlview'

export const textStyle = {
  lineHeight: 29,
  fontSize: 19,
}

export const styles = theme => ({
  h1: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  h2: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  h3: {
    fontWeight: 'bold',
    fontSize: 24,
    lineHeight: 25,
    color: theme.colors.default,
  },
  p: {
    color: theme.colors.default,
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
  },
  em: {
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  i: {
    ...textStyle,
    fontFamily: theme.fontFamily.paragraph,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  a: {
    color: theme.colors.default,
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: theme.colors.primary,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  strong: {
    fontWeight: 'bold',
    color: theme.colors.quart,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  b: {
    fontWeight: 'bold',
    color: theme.colors.quart,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  li: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  ol: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
  ul: {
    color: theme.colors.default,
    fontFamily: theme.fontFamily.paragraph,
    ...textStyle,
  },
})

const StylizedHTMLView = ({ htmlStyle, theme, ...props }) => {
  function renderNode(node, index, siblings, parent, defaultRenderer) {
    if (node.name === 'span') {
      return (
        <Text selectable key={index}>
          {defaultRenderer(node.children, parent)}
        </Text>
      )
    }
  }

  return (
    <HTMLView
      stylesheet={{ ...styles(theme), ...htmlStyle }}
      {...props}
      renderNode={renderNode}
    />
  )
}

export default withTheme(StylizedHTMLView)
