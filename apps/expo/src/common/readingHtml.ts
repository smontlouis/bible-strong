import { DomUtils, parseDocument } from 'htmlparser2'
import { hasChildren, isTag, type AnyNode } from 'domhandler'
import type { MixedStyleDeclaration } from '@native-html/render'
import { scaleFontSize } from '~features/bible/BibleDOM/scaleFontSize'
import { scaleLineHeight } from '~features/bible/BibleDOM/scaleLineHeight'
import { webFontFamily } from '~helpers/webFontFamily'

export type ReadingTypography = { fontFamily: string; fontSize: number; lineHeight: number }
export type ReadingColors = { background: string; text: string; link: string; emphasis: string }
export type HtmlEngine = 'native' | 'dom'
export const getReadingTypography = (
  fontFamily: string,
  scale: number,
  lineHeight: 'small' | 'normal' | 'large'
): ReadingTypography => ({
  fontFamily,
  fontSize: Number.parseFloat(scaleFontSize(19, scale)),
  lineHeight: Number.parseFloat(scaleLineHeight(32, lineHeight, scale)),
})
export const defaultReadingTypography = getReadingTypography('Literata Book', 0, 'normal')

const blockedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'svg',
  'math',
])
/** One HTML contract for both engines: preserve text/links, discard active markup and inline styles. */
export function cleanReadingHTML(html: string): string {
  const document = parseDocument(html)
  const clean = (nodes: AnyNode[]) => {
    for (const node of [...nodes]) {
      if (isTag(node)) {
        if (blockedTags.has(node.name)) {
          DomUtils.removeElement(node)
          continue
        }
        for (const [key, value] of Object.entries(node.attribs)) {
          const name = key.toLowerCase()
          if (
            name.startsWith('on') ||
            ['srcdoc', 'style', 'id'].includes(name) ||
            (['href', 'src', 'xlink:href'].includes(name) &&
              /^(javascript|vbscript|data):/i.test(value.replace(/[\s\u0000-\u001f]/g, '')))
          )
            delete node.attribs[key]
        }
      }
      if (hasChildren(node)) clean(node.children)
    }
  }
  clean(document.children)
  const body = DomUtils.findOne(node => node.name === 'body', document.children, true)
  return DomUtils.getInnerHTML(body ?? document)
}

export function readingHtmlStyles(
  typography: ReadingTypography,
  colors: ReadingColors
): Record<string, MixedStyleDeclaration> {
  const paragraph = { marginTop: typography.fontSize, marginBottom: typography.fontSize }
  return {
    p: paragraph,
    a: { color: colors.link, textDecorationLine: 'underline', textDecorationColor: colors.link },
    strong: { color: colors.emphasis, fontWeight: 'bold' },
    b: { color: colors.emphasis, fontWeight: 'bold' },
    bold: { color: colors.emphasis, fontWeight: 'bold' },
    em: { fontStyle: 'italic' },
    i: { fontStyle: 'italic' },
    ul: { marginTop: 0, marginBottom: 0, paddingLeft: 0, listStyleType: 'none' },
    ol: { ...paragraph, paddingLeft: typography.fontSize * 2 },
    h1: {
      fontSize: typography.fontSize * 2,
      lineHeight: typography.lineHeight * 2,
      fontWeight: 'bold',
      ...paragraph,
    },
    h2: {
      fontSize: typography.fontSize * 1.5,
      lineHeight: typography.lineHeight * 1.5,
      fontWeight: 'bold',
      ...paragraph,
    },
    h3: {
      fontSize: typography.fontSize * 1.17,
      lineHeight: typography.lineHeight * 1.17,
      fontWeight: 'bold',
      ...paragraph,
    },
    blockquote: { ...paragraph, marginLeft: 24, marginRight: 24 },
  }
}

export function readingHtmlCSS(
  typography: ReadingTypography,
  colors: ReadingColors,
  selector = '.editorial-html'
): string {
  const rules = readingHtmlStyles(typography, colors)
  return Object.entries(rules)
    .map(([tag, styles]) => {
      const declarations = Object.entries(styles)
        .map(([key, value]) => {
          const property = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
          return `${property}: ${typeof value === 'number' ? `${value}px` : value}`
        })
        .join('; ')
      return `${selector} ${tag} { ${declarations}; }`
    })
    .join('\n')
}
export { webFontFamily }
