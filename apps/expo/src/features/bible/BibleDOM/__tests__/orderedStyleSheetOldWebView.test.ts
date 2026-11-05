import createOrderedCSSStyleSheet from 'uniwind/components/createOrderedCSSStyleSheet'

// A sheet that parses the way Chromium < 99 does: `@layer` is a syntax error.
const makeSheet = () => {
  const cssRules: { cssText: string }[] = []
  return {
    cssRules,
    insertRule(text: string, index = 0) {
      if (
        text.startsWith('@layer') &&
        typeof (globalThis as any).CSSLayerBlockRule === 'undefined'
      ) {
        throw new DOMException(`Failed to parse the rule '${text}'.`, 'SyntaxError')
      }
      cssRules.splice(index, 0, { cssText: text })
      return index
    },
  } as unknown as CSSStyleSheet
}

describe('createOrderedCSSStyleSheet on a WebView without cascade layers', () => {
  afterEach(() => {
    delete (globalThis as any).CSSLayerBlockRule
  })

  it('keeps inserting rules instead of throwing', () => {
    const sheet = makeSheet()
    const ordered = createOrderedCSSStyleSheet(sheet)

    ordered.insert('.a { color: red; }', 1)
    ordered.insert('.b { color: blue; }', 2)

    const inserted = Array.from(sheet.cssRules).map(rule => rule.cssText)
    expect(inserted).toContain('.a { color: red; }')
    expect(inserted).toContain('.b { color: blue; }')
    expect(inserted.some(text => text.startsWith('@layer'))).toBe(false)
  })

  it('still wraps server output in the layer, where no sheet exists', () => {
    const ordered = createOrderedCSSStyleSheet(null)
    ordered.insert('.a { color: red; }', 1)

    expect(ordered.getTextContent()).toContain('@layer rnw')
  })
})
