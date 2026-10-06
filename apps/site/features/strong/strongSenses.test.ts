import { describe, expect, it } from 'vitest'
import {
  firstNoticeLine,
  groupStrongListLines,
  hasStrongNumberPage,
  strongEntryPageCodes,
  strongSenseSummaries,
  toStrongSenseRef,
  uniqueStrongGlosses,
  type StrongSenseRef,
} from './strongSenses'

const sense = (code: string, classicCode: string, gloss: string): StrongSenseRef => ({
  code,
  classicCode,
  gloss,
  original: 'א',
  transliteration: 'a',
})

const create = [sense('H1254A', 'H1254', 'créer'), sense('H1254B', 'H1254', 'engraisser')]
const zechariah = [
  sense('H2148A', 'H2148', 'Zacharie'),
  sense('H2148C', 'H2148', 'Zacharie'),
  sense('H2148v', 'H2148', 'Zacharie'),
  sense('H2148V', 'H2148', 'Zacharie'),
]
const heaven = [sense('H8064', 'H8064', 'ciel')]
const god = [sense('H0430G', 'H0430', 'Dieu')]
// A number that is itself the code of one of its senses.
const chloe = [
  sense('G5514', 'G5514', 'Chloé'),
  sense('G5514G', 'G5514', 'Chloé'),
  sense('G5514H', 'G5514', 'jeune pousse'),
]

describe('toStrongSenseRef', () => {
  it('reads the codes of a lexicon row', () => {
    expect(
      toStrongSenseRef({
        stepCode: 'H2148v',
        classicStrong: 'H2148',
        gloss: 'Zacharie',
        original: 'זְכַרְיָה',
        transliteration: 'zekaryâh',
      })
    ).toMatchObject({ code: 'H2148v', classicCode: 'H2148' })
  })

  it('leaves out a row whose code cannot be read', () => {
    expect(
      toStrongSenseRef({
        stepCode: '',
        classicStrong: 'H2148',
        gloss: '',
        original: '',
        transliteration: '',
      })
    ).toBeUndefined()
  })
})

describe('hasStrongNumberPage', () => {
  it('gives a page to a number the lexicon splits into senses', () => {
    expect(hasStrongNumberPage('H1254', create)).toBe(true)
    expect(hasStrongNumberPage('H2148', zechariah)).toBe(true)
  })

  it('gives none to a number with one sense, whatever its code', () => {
    expect(hasStrongNumberPage('H8064', heaven)).toBe(false)
    expect(hasStrongNumberPage('H0430', god)).toBe(false)
    expect(hasStrongNumberPage('H9999', [])).toBe(false)
  })

  it('leaves its address to the sense that carries the number as its code', () => {
    expect(hasStrongNumberPage('G5514', chloe)).toBe(false)
  })
})

describe('strongEntryPageCodes', () => {
  it('names a split number once and the other senses by their code', () => {
    expect(strongEntryPageCodes([...create, ...heaven, ...zechariah, ...god, ...chloe])).toEqual([
      'H1254',
      'H8064',
      'H2148',
      'H0430G',
      'G5514',
      'G5514G',
      'G5514H',
    ])
  })
})

describe('groupStrongListLines', () => {
  it('gathers the senses of a number that read the same into one line', () => {
    expect(groupStrongListLines(zechariah)).toEqual([
      { code: 'H2148', gloss: 'Zacharie', original: 'א', transliteration: 'a', senseCount: 4 },
    ])
  })

  it('keeps a line for a sense with a gloss of its own', () => {
    expect(groupStrongListLines(create).map(line => [line.code, line.senseCount])).toEqual([
      ['H1254A', undefined],
      ['H1254B', undefined],
    ])
  })

  it('gathers by gloss within a number, not across numbers', () => {
    const judas = [
      sense('G2455G', 'G2455', 'Juda'),
      sense('G2455H', 'G2455', 'Judas'),
      sense('G2455I', 'G2455', 'judas'),
      sense('G2453', 'G2453', 'Judas'),
    ]
    expect(groupStrongListLines(judas).map(line => [line.code, line.senseCount])).toEqual([
      ['G2455G', undefined],
      ['G2455', 2],
      ['G2453', undefined],
    ])
  })

  it('lists apart the senses of a number that has no page of its own', () => {
    expect(groupStrongListLines(chloe).map(line => line.code)).toEqual([
      'G5514',
      'G5514G',
      'G5514H',
    ])
  })
})

describe('firstNoticeLine', () => {
  it('reads the first entry of an outline without its number', () => {
    expect(
      firstNoticeLine('1) créer, façonner, former<br>1a) (Qal) façonner, former', 'créer')
    ).toBe('créer, façonner, former')
  })

  it('passes over a labelled line that only repeats the gloss', () => {
    expect(
      firstNoticeLine(
        '<p><strong>Sens STEP :</strong> engraisser</p><p><strong>Définition lexicale exacte :</strong> être gras</p><p><strong>Partie du discours :</strong> verbe</p>',
        'engraisser'
      )
    ).toBe('être gras')
  })

  it('stops a notice about a person at its first line', () => {
    expect(
      firstNoticeLine(
        'Un homme ayant vécu à l’époque de la Monarchie divisée, mentionné uniquement en 1Ch.27.21 ; <br> père de : Iddo (H3035)',
        'Zacharie'
      )
    ).toBe(
      'Un homme ayant vécu à l’époque de la Monarchie divisée, mentionné uniquement en 1Ch.27.21'
    )
  })

  it('keeps the bold word an article opens with', () => {
    expect(firstNoticeLine('<b>χωρίον</b>, -ου, τό<br> (diminutif de χώρα)', 'lieu')).toBe(
      'χωρίον, -ου, τό'
    )
  })

  it('finds nothing in a notice that only repeats the gloss', () => {
    expect(firstNoticeLine('<p>Créer.</p>', 'créer')).toBeUndefined()
    expect(firstNoticeLine(undefined, 'créer')).toBeUndefined()
  })
})

describe('strongSenseSummaries', () => {
  it('says who a person is before quoting a notice', () => {
    expect(
      strongSenseSummaries([
        { brief: 'Époux de Marie', noticeHtml: 'Ἰωσήφ, Joseph', gloss: 'Joseph' },
        { brief: 'D’Arimathie', noticeHtml: 'Ἰωσήφ, Joseph', gloss: 'Joseph' },
      ])
    ).toEqual(['Époux de Marie', 'D’Arimathie'])
  })

  it('quotes the first line of the notice of a sense that has its own', () => {
    expect(
      strongSenseSummaries([
        { noticeHtml: '1) créer, façonner<br>1a) former', gloss: 'créer' },
        { noticeHtml: '<p><b>Sens :</b> engraisser</p><p>être gras</p>', gloss: 'engraisser' },
      ])
    ).toEqual(['créer, façonner', 'être gras'])
  })

  it('leaves out a line several senses share', () => {
    expect(
      strongSenseSummaries([
        { noticeHtml: '<b>χωρίον</b>, un lieu', gloss: 'lieu' },
        { noticeHtml: '<b>χωρίον</b>, un lieu', gloss: 'propriété' },
        { noticeHtml: 'un domaine', gloss: 'domaine' },
      ])
    ).toEqual([undefined, undefined, 'un domaine'])
  })
})

describe('uniqueStrongGlosses', () => {
  it('reads each gloss once, in the order of the senses', () => {
    expect(uniqueStrongGlosses([...zechariah, ...create, sense('X', 'X', ' Créer ')])).toEqual([
      'Zacharie',
      'créer',
      'engraisser',
    ])
  })
})
