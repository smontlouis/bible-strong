import {
  getScaledStrongTextStyle,
  getStrongEditorialHtmlStyles,
} from '../strongEditorialHtmlStyles'

describe('getStrongEditorialHtmlStyles', () => {
  const readingTypography = {
    fontFamily: 'Literata',
    fontSizeScale: 2,
    lineHeight: 'large' as const,
  }

  it('uses the scaled Bible Viewer typography and the theme colors', () => {
    const styles = getStrongEditorialHtmlStyles(
      {
        colors: {
          default: '#f5f5f5',
          primary: '#4f80ff',
          quart: '#ef4444',
        },
      } as Parameters<typeof getStrongEditorialHtmlStyles>[0],
      readingTypography
    )

    for (const tag of ['p', 'li', 'ol', 'ul', 'h1', 'h2', 'h3']) {
      expect(styles[tag]).toMatchObject({
        color: '#f5f5f5',
        fontFamily: 'Literata',
        fontSize: 21.6,
        lineHeight: 47,
      })
    }
    for (const tag of ['b', 'strong']) {
      expect(styles[tag]).toMatchObject({
        fontFamily: 'Literata',
        fontSize: 21.6,
        lineHeight: 47,
        fontWeight: 'bold',
      })
      expect(styles[tag]).not.toHaveProperty('color')
    }
    for (const tag of ['em', 'i']) {
      expect(styles[tag]).toMatchObject({
        color: '#ef4444',
        fontFamily: 'Literata',
        fontSize: 21.6,
        lineHeight: 47,
        fontStyle: 'italic',
      })
    }
    expect(styles.a).toMatchObject({
      color: '#4f80ff',
      fontFamily: 'Literata',
      fontSize: 21.6,
      lineHeight: 47,
    })
  })

  it('returns numeric scaled values for native Strong text', () => {
    expect(getScaledStrongTextStyle(20, 30, readingTypography)).toEqual({
      fontFamily: 'Literata',
      fontSize: 24,
      lineHeight: 50,
    })
  })
})
