import { createStrongLexiconModuleDownloadPlan } from '../strongLexiconDownloadItems'
import { getStrongLexiconPublication } from '../strongLexiconPublications'

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

describe('Strong lexicon modular publications', () => {
  it('publishes the mandatory core and two independent enrichments from /databases', () => {
    expect(getStrongLexiconPublication('core')).toMatchObject({
      required: true,
      entry: 'strong_lexicon.core.sqlite',
      archiveBytes: 6_543_526,
    })
    expect(
      getStrongLexiconPublication('core').url.endsWith('databases/strong_lexicon.core.sqlite.zip')
    ).toBe(true)
    expect(
      getStrongLexiconPublication('resources').url.endsWith(
        'databases/strong_lexicon.resources.sqlite.zip'
      )
    ).toBe(true)
    expect(getStrongLexiconPublication('entities')).toMatchObject({
      required: false,
      entry: 'bible_entities.production.sqlite',
    })
    expect(
      getStrongLexiconPublication('entities').url.endsWith(
        'databases/bible_entities.production.sqlite.zip'
      )
    ).toBe(true)
    expect(getStrongLexiconPublication('core')).toMatchObject({
      contentBytes: 30_371_840,
      contentSha256: '4697c3a496a7e647922114771a0332530a21c86752fb67d1d98cf7bfd00fd3e1',
    })
  })

  it('makes an optional module depend on core when core is absent', () => {
    expect(createStrongLexiconModuleDownloadPlan('resources', false).map(item => item.id)).toEqual([
      'strong-lexicon:core',
      'strong-lexicon:resources',
    ])
    expect(createStrongLexiconModuleDownloadPlan('resources', false)[1].dependsOnId).toBe(
      'strong-lexicon:core'
    )
  })

  it('downloads an optional module alone once core is available', () => {
    const [item] = createStrongLexiconModuleDownloadPlan('entities', true)
    expect(item).toMatchObject({
      id: 'strong-lexicon:entities',
      type: 'strong-lexicon-module',
      strongLexiconModuleId: 'entities',
    })
    expect(item).not.toHaveProperty('dependsOnId')
  })
})
