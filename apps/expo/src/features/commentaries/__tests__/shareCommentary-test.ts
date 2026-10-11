import {
  commentaryHtmlToText,
  getCommentaryShare,
  getCommentaryShareText,
} from '../shareCommentary'

jest.mock('~features/share/resourceShare', () => ({}))

const entry = {
  id: 'mhy-fr',
  author: 'Matthew Henry',
  title: 'Commentaire concis de Matthew Henry',
}
const location = { language: 'fr' as const, book: 1, chapter: 1 }

it('converts commentary HTML to plain paragraphs with decoded spaces', () => {
  expect(
    commentaryHtmlToText(
      '<h3>Dieu crée les cieux.</h3><p>Que de puissance&amp;nbsp;!<br>Dans la <a href="#">Parole</a>.</p>\n\n<p>  Fin   du texte. </p>'
    )
  ).toBe('Dieu crée les cieux.\n\nQue de puissance !\nDans la Parole.\n\nFin du texte.')
})

it('formats the copied text like the pre-27 commentary share, without any link', () => {
  expect(
    getCommentaryShareText({
      entry,
      passage: 'Genèse 1:1–2',
      sections: [{ content: '<p>Au commencement.</p>' }],
    })
  ).toBe('Matthew Henry\nCommentaire concis de Matthew Henry\nGenèse 1:1–2\n\nAu commencement.')
})

it('links the page of the chapter, and keeps the text apart from the link', async () => {
  const share = getCommentaryShare({
    entry,
    passage: 'Genèse 1:1–2',
    sections: [{ content: '<p>Au commencement.</p>' }],
    location,
  })
  expect(share.url).toBe('https://bible-strong.app/commentary/fr/mhy-fr/gen/1')
  expect(await share.text()).not.toContain('bible-strong.app')
})

it('has no link when the commentary has no page for that chapter', () => {
  expect(
    getCommentaryShare({
      entry: { ...entry, id: 'unknown' },
      passage: 'Genèse 1',
      sections: [{ content: '<p>Au commencement.</p>' }],
      location,
    }).url
  ).toBeUndefined()
})

it('labels chapter sections and truncates long commentaries on a word boundary', () => {
  const text = getCommentaryShareText({
    entry,
    passage: 'Genèse 1',
    sections: [
      { reference: 'Genèse 1:1', content: '<p>Premier.</p>' },
      { reference: 'Genèse 1:2', content: `<p>${'mot '.repeat(3000)}</p>` },
    ],
  })
  expect(text).toContain('Genèse 1:1\nPremier.\n\nGenèse 1:2\nmot mot')
  const body = text.split('\n\n').slice(1).join('\n\n')
  expect(body.length).toBeLessThanOrEqual(10001)
  expect(body.endsWith('mot…')).toBe(true)
})
