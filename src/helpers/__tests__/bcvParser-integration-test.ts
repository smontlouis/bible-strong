import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js'
import * as en from 'bible-passage-reference-parser/esm/lang/en.js'

describe('vendored BCV parser', () => {
  it('rejects short lowercase book false positives in strict mode', () => {
    const parser = new bcv_parser(en)

    expect(parser.parse('she is 2 cool').osis()).toBe('Isa.2')

    parser.set_options({ book_match_strategy: 'strict' })

    expect(parser.parse('she is 2 cool').osis()).toBe('')
    expect(parser.parse('Isaiah 2').osis()).toBe('Isa.2')
  })
})
