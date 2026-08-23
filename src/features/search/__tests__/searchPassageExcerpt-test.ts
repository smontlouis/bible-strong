import { getPassageSearchExcerpt } from '../shared/searchPassageExcerpt'

describe('getPassageSearchExcerpt', () => {
  it('centers a long passage around its highlighted occurrence', () => {
    const result = getPassageSearchExcerpt(
      `Dans toute affaire frauduleuse concernant un bœuf, un âne, un agneau, un vêtement, ou un objet perdu, au sujet duquel on dira : C’est cela ! La cause ira jusqu’à Dieu ; celui que Dieu {{condamnera}} fera une restitution.${' La suite du passage'.repeat(8)}`
    )

    expect(result).toContain('{{condamnera}}')
    expect(result).toMatch(/^… /u)
    expect(result).toMatch(/ …$/u)
    expect(result).not.toContain('Dans toute affaire')
  })

  it('keeps nearby highlighted words in the same excerpt', () => {
    const result = getPassageSearchExcerpt(
      `${'Introduction '.repeat(10)}Dieu a tant {{aimé}} le {{monde}} et lui a donné son fils.${' Conclusion'.repeat(10)}`
    )

    expect(result).toContain('{{aimé}}')
    expect(result).toContain('{{monde}}')
  })

  it('keeps a match near the end inside the visible half of the excerpt', () => {
    const result = getPassageSearchExcerpt(
      'Si un homme tue quelqu’un, on ôtera la vie au meurtrier, sur la déposition de témoins. Un seul témoin ne suffira pas pour faire {{condamner}} une personne à mort.'
    )

    expect(result).toContain('{{condamner}}')
    expect(result.indexOf('{{condamner}}')).toBeLessThan(45)
  })

  it('preserves short passages and passages without highlights', () => {
    expect(getPassageSearchExcerpt('Jésus {{pleura}}.')).toBe('Jésus {{pleura}}.')
    expect(getPassageSearchExcerpt('Un passage sans résultat marqué.')).toBe(
      'Un passage sans résultat marqué.'
    )
  })
})
