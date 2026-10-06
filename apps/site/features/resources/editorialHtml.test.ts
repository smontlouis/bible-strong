import { describe, expect, it } from 'vitest'
import { editorialHtmlToText, sanitizeEditorialHtml, truncateText } from './editorialHtml'

describe('sanitizeEditorialHtml', () => {
  it('keeps allowlisted formatting and drops every attribute', () => {
    expect(sanitizeEditorialHtml('<b class="x" onclick="evil()">mot</b><br />suite')).toBe(
      '<b>mot</b><br>suite'
    )
  })

  it('drops unknown tags but keeps their text', () => {
    expect(sanitizeEditorialHtml('<script>alert(1)</script><a href="javascript:x">lien</a>')).toBe(
      'alert(1)lien'
    )
    expect(sanitizeEditorialHtml('<img src=x onerror=alert(1)>texte')).toBe('texte')
  })

  it('closes unbalanced markup and ignores stray closing tags', () => {
    expect(sanitizeEditorialHtml('<i>un <b>deux</i> trois')).toBe('<i>un <b>deux</b></i> trois')
    expect(sanitizeEditorialHtml('fin</b>')).toBe('fin')
  })

  it('neutralizes stray angle brackets', () => {
    expect(sanitizeEditorialHtml('a < b et <strong="H3068G">nom</strong>')).toBe(
      'a &lt; b et <strong>nom</strong>'
    )
  })
})

describe('editorialHtmlToText', () => {
  it('produces collapsed plain text', () => {
    expect(editorialHtmlToText('1) cr&eacute;er,&nbsp;former<br>1a) <i>Qal</i> &amp; Niphal')).toBe(
      '1) cr&eacute;er, former 1a) Qal & Niphal'
    )
  })
})

describe('truncateText', () => {
  it('cuts on a word boundary and marks the cut', () => {
    expect(truncateText('créer, façonner, former le ciel et la terre', 24)).toBe(
      'créer, façonner, former…'
    )
    expect(truncateText('court', 24)).toBe('court')
  })
})
