import { getCanonicalChapterPericope } from '../canonicalBibleHeadings'

describe('canonicalBibleHeadings', () => {
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
