import {
  getLegacyLinkPressArguments,
  hasWidthSensitiveHtmlContent,
  LINK_TEXT_ATTRIBUTE,
  linkifyStrongReferences,
} from '../stylizedHtmlUtils'

describe('linkifyStrongReferences', () => {
  it('turns bare Hebrew and Greek Strong references into links', () => {
    expect(linkifyStrongReferences('<p>Voir H7225 et G746.</p>')).toBe(
      '<p>Voir <a href="strong://H7225" data-strong-number="7225" data-strong-book="1">H7225</a> et <a href="strong://G746" data-strong-number="746" data-strong-book="40">G746</a>.</p>'
    )
  })

  it('does not alter references in attributes or existing anchors', () => {
    expect(
      linkifyStrongReferences('<p data-code="H7225"><a href="/H7225">H7225</a> G746</p>')
    ).toBe(
      '<p data-code="H7225"><a href="/H7225">H7225</a> <a href="strong://G746" data-strong-number="746" data-strong-book="40">G746</a></p>'
    )
  })

  it('does not match partial Strong references', () => {
    expect(linkifyStrongReferences('<p>AH7225 H7225G G746a</p>')).toBe('<p>AH7225 H7225G G746a</p>')
  })
})

describe('hasWidthSensitiveHtmlContent', () => {
  it('identifies embedded content that must wait for the host width', () => {
    expect(hasWidthSensitiveHtmlContent('<p>Texte</p><img src="image.jpg">')).toBe(true)
    expect(hasWidthSensitiveHtmlContent('<table><tr><td>Texte</td></tr></table>')).toBe(true)
  })

  it('does not delay ordinary lexical HTML', () => {
    expect(hasWidthSensitiveHtmlContent('<p>Texte <strong>lexical</strong></p>')).toBe(false)
  })
})

describe('getLegacyLinkPressArguments', () => {
  it('preserves the visible text and class of regular anchors', () => {
    expect(
      getLegacyLinkPressArguments('/Gen_1.1', {
        [LINK_TEXT_ATTRIBUTE]: 'Genèse 1.1',
        class: 'bible-ref',
      })
    ).toEqual(['/Gen_1.1', 'Genèse 1.1', 'bible-ref'])
  })

  it('uses an empty class for regular anchors without one', () => {
    expect(
      getLegacyLinkPressArguments('https://example.com', {
        [LINK_TEXT_ATTRIBUTE]: 'Exemple',
      })
    ).toEqual(['https://example.com', 'Exemple', ''])
  })

  it('maps generated Strong anchors to the historical number and book arguments', () => {
    expect(
      getLegacyLinkPressArguments('strong://H7225', {
        'data-strong-number': '7225',
        'data-strong-book': '1',
      })
    ).toEqual(['7225', 1])
  })
})
