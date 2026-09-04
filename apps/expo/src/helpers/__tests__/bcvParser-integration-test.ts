import { createBibleReferenceParser } from '@bible-strong/bible-reference-parser/reference-parser'

const createFrenchParser = () => {
  return createBibleReferenceParser('fr')
}

describe('vendored BCV parser', () => {
  it('rejects short lowercase book false positives in strict mode', () => {
    const parser = createBibleReferenceParser('en')

    expect(parser.parse('she is 2 cool').osis()).toBe('')
    expect(parser.parse('Isaiah 2').osis()).toBe('Isa.2')
  })

  it('parses numbered Ro abbreviations as Kings rather than Romans', () => {
    const parser = createFrenchParser()

    expect(parser.parse('1Ro.1 ; 2 etc. ; 2Ro.8.19').osis()).toBe('1Kgs.1,1Kgs.2,2Kgs.8.19')
  })

  it('parses legacy French book abbreviations used by Strong entities', () => {
    const parser = createFrenchParser()

    expect(parser.parse('Esr.3.10 ; Can.4.4 ; Ézé.34.23 ; Osé.3.5').osis()).toBe(
      'Ezra.3.10,Song.4.4,Ezek.34.23,Hos.3.5'
    )
  })
})
