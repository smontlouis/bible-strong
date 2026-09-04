import type { MixedStyleDeclaration } from '@native-html/render'

import type { Theme } from '~themes'

const compactText = {
  fontSize: 13,
  lineHeight: 18,
}

export const getStrongSelectionPreviewHtmlStyles = (
  theme: Theme
): Record<string, MixedStyleDeclaration> => ({
  p: {
    ...compactText,
    color: theme.colors.tertiary,
    marginTop: 0,
    marginBottom: 5,
  },
  em: {
    ...compactText,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  i: {
    ...compactText,
    color: theme.colors.quart,
    fontStyle: 'italic',
    fontWeight: 'bold',
  },
  a: {
    ...compactText,
    color: theme.colors.tertiary,
  },
  strong: {
    ...compactText,
    color: theme.colors.tertiary,
    fontWeight: 'bold',
  },
  b: {
    ...compactText,
    color: theme.colors.tertiary,
    fontWeight: 'bold',
  },
  li: {
    ...compactText,
    color: theme.colors.tertiary,
  },
  ol: {
    ...compactText,
    color: theme.colors.tertiary,
  },
  ul: {
    ...compactText,
    color: theme.colors.tertiary,
  },
  h1: {
    ...compactText,
    color: theme.colors.tertiary,
    fontWeight: 'bold',
  },
  h2: {
    ...compactText,
    color: theme.colors.tertiary,
    fontWeight: 'bold',
  },
  h3: {
    ...compactText,
    color: theme.colors.tertiary,
    fontWeight: 'bold',
  },
})
