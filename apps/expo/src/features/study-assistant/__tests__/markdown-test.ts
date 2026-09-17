import { prepareMarkdown, safeLink } from '../markdown'

describe('generated Markdown', () => {
  it('keeps formatting while removing automatic image loading', () => {
    expect(prepareMarkdown('**Texte** ![photo](https://example.com/pixel)')).toBe(
      '**Texte** [photo](https://example.com/pixel)'
    )
    expect(prepareMarkdown('\\![photo](https://example.com/pixel)')).not.toContain('![')
    expect(prepareMarkdown('<img src="https://example.com/pixel">')).not.toContain('<img')
  })
  it('only opens HTTP(S) links', () => {
    expect(safeLink('javascript:alert(1)')).toBeUndefined()
    expect(safeLink('file:///etc/passwd')).toBeUndefined()
    expect(safeLink('data:text/html,hello')).toBeUndefined()
    expect(safeLink('https://bible-strong.app')).toBe('https://bible-strong.app/')
  })
})
