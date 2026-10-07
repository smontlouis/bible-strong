import { getStrongShareUrl, getVersesShareUrl, PUBLIC_SITE_URL } from '../publicSiteLinks'

describe('public site links', () => {
  it('opens a single verse and a run of verses as a passage', () => {
    expect(getVersesShareUrl(['43-3-16'], 'LSG')).toBe(
      'https://bible-strong.app/bible/lsg/john/3/16'
    )
    expect(getVersesShareUrl(['43-3-17', '43-3-16', '43-3-18'], 'KJV')).toBe(
      'https://bible-strong.app/bible/kjv/john/3/16-18'
    )
  })

  it('opens the chapter when the verses do not follow each other', () => {
    expect(getVersesShareUrl(['19-23-1', '19-23-4'], 'LSG')).toBe(
      'https://bible-strong.app/bible/lsg/ps/23'
    )
    expect(getVersesShareUrl(['43-3-36', '43-4-1'], 'LSG')).toBe(
      'https://bible-strong.app/bible/lsg/john/3'
    )
  })

  it('writes the version as the site does', () => {
    expect(getVersesShareUrl(['1-1-1'], 'LXX_FR')).toBe(
      'https://bible-strong.app/bible/lxx-fr/gen/1/1'
    )
  })

  it('falls back to the home page for what the site does not serve', () => {
    expect(getVersesShareUrl(['1-1-1'], 'UNKNOWN')).toBe(PUBLIC_SITE_URL)
    expect(getVersesShareUrl([], 'LSG')).toBe(PUBLIC_SITE_URL)
  })

  it('opens a Strong entry in the language of the lexicon', () => {
    expect(getStrongShareUrl('H430', 'hebrew', 'fr')).toBe(
      'https://bible-strong.app/strong/fr/h0430'
    )
    expect(getStrongShareUrl('G26', 'greek', 'en')).toBe('https://bible-strong.app/strong/en/g0026')
  })
})
