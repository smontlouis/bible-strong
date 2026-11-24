import { answerPlainText } from '../answerText'

it('keeps the label of the links that only work inside the conversation', () => {
  expect(
    answerPlainText(
      'Voir [Jean 3:16](https://bible-strong.app/assistant-passage/John.3.16) et [Clarke](https://bible-strong.app/assistant-source/s2).\n\n[Concordance](https://bible-strong.app/assistant-widget/w3)\n'
    )
  ).toBe('Voir Jean 3:16 et Clarke.\n\nConcordance')
})

it('leaves ordinary Markdown and outside links as they are', () => {
  const text = '**Abel** veut dire *souffle* : [article](https://example.org/abel).'
  expect(answerPlainText(text)).toBe(text)
})
