import { messageSegments, placedWidgetIds, WIDGET_LINK_PREFIX } from '../widgetSegments'

const link = (label: string, id: string) => `[${label}](${WIDGET_LINK_PREFIX}${id})`

it('splits an answer into Markdown and cards in reading order', () => {
  const text = `Le verbe revient trois fois.\n\n${link('Mots du verset', 'w1')}\n\nIl signifie demeurer.\n\n${link('G3306', 'w2')}`
  expect(messageSegments(text, new Set(['w1', 'w2']))).toEqual([
    { type: 'markdown', text: 'Le verbe revient trois fois.' },
    { type: 'widget', id: 'w1', label: 'Mots du verset' },
    { type: 'markdown', text: 'Il signifie demeurer.' },
    { type: 'widget', id: 'w2', label: 'G3306' },
  ])
})

it('keeps only the title of unknown or repeated cards, and leaves other links alone', () => {
  const text = `Voir ${link('Carte', 'w9')} et ${link('A', 'w1')} puis ${link('B', 'w1')}, [source](https://bible-strong.app/assistant-source/s1).`
  expect(messageSegments(text, new Set(['w1']))).toEqual([
    { type: 'markdown', text: 'Voir Carte et' },
    { type: 'widget', id: 'w1', label: 'A' },
    { type: 'markdown', text: 'puis B, [source](https://bible-strong.app/assistant-source/s1).' },
  ])
  expect([...placedWidgetIds(text, new Set(['w1']))]).toEqual(['w1'])
})

it('leaves answers without card links as a single Markdown block', () => {
  expect(messageSegments('Une réponse simple.', new Set(['w1']))).toEqual([
    { type: 'markdown', text: 'Une réponse simple.' },
  ])
  expect(messageSegments('', new Set())).toEqual([])
  expect(placedWidgetIds('Une réponse simple.', new Set(['w1'])).size).toBe(0)
})
