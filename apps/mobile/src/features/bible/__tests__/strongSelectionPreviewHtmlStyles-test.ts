import { getStrongSelectionPreviewHtmlStyles } from '../strongSelectionPreviewHtmlStyles'

describe('getStrongSelectionPreviewHtmlStyles', () => {
  it('keeps every text tag at the compact preview size', () => {
    const styles = getStrongSelectionPreviewHtmlStyles({
      colors: {
        quart: '#c44',
        tertiary: '#777',
      },
    } as Parameters<typeof getStrongSelectionPreviewHtmlStyles>[0])

    for (const tag of ['p', 'em', 'i', 'a', 'strong', 'b', 'li', 'ol', 'ul', 'h1', 'h2', 'h3']) {
      expect(styles[tag]).toMatchObject({
        fontSize: 13,
        lineHeight: 18,
      })
    }
  })
})
