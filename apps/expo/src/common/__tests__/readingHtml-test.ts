import {
  cleanReadingHTML,
  getReadingTypography,
  readingHtmlCSS,
  readingHtmlStyles,
} from '../readingHtml'

const colors = { background: '#fff', text: '#111', link: '#5890ff', emphasis: '#c00' }
it('uses Bible font sizing and line spacing', () => {
  expect(getReadingTypography('Avenir', 0, 'normal')).toEqual({
    fontFamily: 'Avenir',
    fontSize: 19,
    lineHeight: 35,
  })
  expect(getReadingTypography('Literata Book', 2, 'large')).toEqual({
    fontFamily: 'Literata Book',
    fontSize: 22.8,
    lineHeight: 54,
  })
  expect(getReadingTypography('Arial', -1, 'small')).toEqual({
    fontFamily: 'Arial',
    fontSize: 17.1,
    lineHeight: 23,
  })
})
it('keeps link identity and emphasis while removing executable markup and inline typography', () => {
  const html = cleanReadingHTML(
    '<html><body><p style="font-size:99px" onclick="bad()"><a href="Gen.1.1" class="verse">Genèse <b>1</b></a><script>bad()</script><a href="java&#115;cript:bad()">danger</a></p></body></html>'
  )
  expect(html).toContain('href="Gen.1.1" class="verse"')
  expect(html).toContain('<b>1</b>')
  expect(html).not.toMatch(/onclick|font-size|script|<body/)
})
it('gives native and DOM the same blue underlined links and restrained emphasis', () => {
  const typography = getReadingTypography('Avenir', 0, 'normal')
  expect(readingHtmlStyles(typography, colors).a).toEqual({
    color: '#5890ff',
    textDecorationLine: 'underline',
    textDecorationColor: '#5890ff',
  })
  expect(readingHtmlStyles(typography, colors).em).toEqual({ fontStyle: 'italic' })
  expect(readingHtmlCSS(typography, colors)).toContain(
    '.editorial-html a { color: #5890ff; text-decoration-line: underline; text-decoration-color: #5890ff; }'
  )
})

it('scopes compact preview styles independently from the article', () => {
  const articleSelector = '.editorial-html[data-reading-id="article"]'
  const previewSelector = '.editorial-html[data-reading-id="preview"]'
  const article = readingHtmlCSS(
    { fontFamily: 'Arial', fontSize: 23, lineHeight: 40 },
    colors,
    articleSelector
  )
  const preview = readingHtmlCSS(
    { fontFamily: 'Arial', fontSize: 16, lineHeight: 24 },
    colors,
    previewSelector
  )
  for (const rule of article.split('\n')) expect(rule.startsWith(articleSelector + ' ')).toBe(true)
  for (const rule of preview.split('\n')) expect(rule.startsWith(previewSelector + ' ')).toBe(true)
  expect(article).toContain('font-size: 46px; line-height: 80px')
  expect(preview).toContain('font-size: 32px; line-height: 48px')
  expect(preview).not.toContain(articleSelector)
})
