import {
  getCanonicalBibleHeadingReferences,
  getCanonicalChapterPericope,
} from '../canonicalBibleHeadings'

describe('canonicalBibleHeadings', () => {
  it('preserves the exact OSIS targets and text positions of parallel references', () => {
    expect(
      getCanonicalBibleHeadingReferences({
        offset: 0,
        order: 0,
        kind: 'parallel',
        type: 'parallel',
        text: ' (John 1:1–5; Hebrews 11:1–3) ',
        markup:
          '<title type="parallel"> (<reference osisref="John.1.1-John.1.5" type="parallel">John 1:1–5</reference>; <reference osisref="Heb.11.1-Heb.11.3" type="parallel">Hebrews 11:1–3</reference>) </title>',
      })
    ).toEqual([
      {
        osis: 'John.1.1-John.1.5',
        text: 'John 1:1–5',
        start: 1,
        end: 11,
      },
      {
        osis: 'Heb.11.1-Heb.11.3',
        text: 'Hebrews 11:1–3',
        start: 13,
        end: 27,
      },
    ])
  })

  it('maps V4 headings to the existing chapter pericope contract', () => {
    expect(
      getCanonicalChapterPericope([
        {
          Livre: 1,
          Chapitre: 1,
          Verset: 1,
          Texte: 'In the beginning',
          Headings: [
            {
              offset: 0,
              order: 0,
              kind: 'pericope',
              type: 'section',
              text: 'The Creation',
              markup: '<title type="section">The Creation</title>',
            },
            {
              offset: 0,
              order: 2,
              kind: 'heading',
              type: 'scope',
              text: 'Genesis 1–11',
              markup: '<title type="scope">Genesis 1–11</title>',
            },
            {
              offset: 0,
              order: 1,
              kind: 'parallel',
              type: 'parallel',
              text: 'John 1:1–3',
              markup: '<title type="parallel">John 1:1–3</title>',
            },
          ],
        },
      ])
    ).toEqual({
      '1': {
        '1': {
          '1': {
            h3: 'The Creation',
            h4: 'John 1:1–3',
            h2: 'Genesis 1–11',
          },
        },
      },
    })
  })

  it('keeps every heading when two V4 headings prefer the same legacy level', () => {
    const headings = getCanonicalChapterPericope([
      {
        Livre: 22,
        Chapitre: 3,
        Verset: 6,
        Texte: 'Who is this',
        Headings: [
          {
            offset: 0,
            order: 0,
            kind: 'pericope',
            type: 'section',
            text: 'The Bride',
            markup: '<title type="section">The Bride</title>',
          },
          {
            offset: 0,
            order: 1,
            kind: 'heading',
            type: 'scope',
            text: 'Song 3:6–5:1',
            markup: '<title type="scope">Song 3:6–5:1</title>',
          },
          {
            offset: 0,
            order: 2,
            kind: 'heading',
            type: 'scope',
            text: 'The Wedding',
            markup: '<title type="scope">The Wedding</title>',
          },
        ],
      },
    ])

    expect(Object.values(headings['22']['3']['6'])).toEqual(
      expect.arrayContaining(['The Bride', 'Song 3:6–5:1', 'The Wedding'])
    )
  })
})
