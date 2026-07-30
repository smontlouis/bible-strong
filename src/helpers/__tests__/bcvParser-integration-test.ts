import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js'
import * as en from 'bible-passage-reference-parser/esm/lang/en.js'
import * as fr from 'bible-passage-reference-parser/esm/lang/fr.js'

const createFrenchParser = () => {
  const parser = new bcv_parser(fr)
  parser.set_options({
    book_match_strategy: 'strict',
    consecutive_combination_strategy: 'separate',
    sequence_combination_strategy: 'separate',
    testaments: 'ona',
  })
  return parser
}

describe('vendored BCV parser', () => {
  it('rejects short lowercase book false positives in strict mode', () => {
    const parser = new bcv_parser(en)

    expect(parser.parse('she is 2 cool').osis()).toBe('Isa.2')

    parser.set_options({ book_match_strategy: 'strict' })

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
