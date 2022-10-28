import React from 'react'
import { useTheme } from 'emotion-theming'
import { PropsWithChildren } from 'react'
import Markdown from 'react-native-markdown-display'
import { textStyle } from './StylizedHTMLView'
import { StyleSheet } from 'react-native'
import { Theme } from '~themes/index'

const styles = (theme: Theme) =>
  StyleSheet.create({
    heading1: {
      fontWeight: 'bold',
      fontSize: 24,
      lineHeight: 25,
      color: theme.colors.default,
    },
    heading2: {
      fontWeight: 'bold',
      fontSize: 24,
      lineHeight: 25,
      color: theme.colors.default,
    },
    heading3: {
      fontWeight: 'bold',
      fontSize: 24,
      lineHeight: 25,
      color: theme.colors.default,
    },
    body: {
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
    link: {
      color: theme.colors.primary,
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
      fontFamily: theme.fontFamily.text,
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

const StylizedMarkdown = ({ children }: PropsWithChildren<{}>) => {
  const theme = useTheme<Theme>()
  return <Markdown style={styles(theme)}>{children}</Markdown>
}

export default StylizedMarkdown
