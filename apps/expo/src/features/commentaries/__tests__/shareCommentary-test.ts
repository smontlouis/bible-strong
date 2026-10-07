import { commentaryHtmlToText, getCommentaryShareMessage } from '../shareCommentary'

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))
jest.mock('react-native', () => ({ Share: { share: jest.fn() } }))
jest.mock('~helpers/toast', () => ({ toast: { error: jest.fn() } }))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

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

it('formats the share message like the pre-27 commentary share, ending on the page of the chapter', () => {
  expect(
    getCommentaryShareMessage({
      entry,
      passage: 'Genèse 1:1–2',
      sections: [{ content: '<p>Au commencement.</p>' }],
      location,
    })
  ).toBe(
    'Matthew Henry\nCommentaire concis de Matthew Henry\nGenèse 1:1–2\n\nAu commencement.\n\nhttps://bible-strong.app/commentary/fr/mhy-fr/gen/1'
  )
})

it('ends on the home page when the commentary has no page for that chapter', () => {
  expect(
    getCommentaryShareMessage({
      entry: { ...entry, id: 'unknown' },
      passage: 'Genèse 1',
      sections: [{ content: '<p>Au commencement.</p>' }],
      location,
    })
  ).toMatch(/\n\nhttps:\/\/bible-strong\.app$/u)
})

it('labels chapter sections and truncates long commentaries on a word boundary', () => {
  const message = getCommentaryShareMessage({
    entry,
    passage: 'Genèse 1',
    sections: [
      { reference: 'Genèse 1:1', content: '<p>Premier.</p>' },
      { reference: 'Genèse 1:2', content: `<p>${'mot '.repeat(3000)}</p>` },
    ],
    location,
  })
  expect(message).toContain('Genèse 1:1\nPremier.\n\nGenèse 1:2\nmot mot')
  const body = message.split('\n\n').slice(1, -1).join('\n\n')
  expect(body.length).toBeLessThanOrEqual(10001)
  expect(body.endsWith('mot…')).toBe(true)
})
