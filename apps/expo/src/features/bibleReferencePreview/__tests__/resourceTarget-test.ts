import { parseResourcePreviewLink, type PreviewSource } from '../resourceTarget'
import { loadResourcePreview } from '../loadResourcePreview'

const dictionary: PreviewSource = {
  kind: 'dictionary',
  work: 'bost',
  resourceId: 'dictionary-bost-fr',
  dictionaryTitle: 'Bost',
  language: 'fr',
}
it('keeps dictionary work, language and resource identity for internal words', () => {
  expect(parseResourcePreviewLink({ href: 'Abana', type: 'dictionary' }, dictionary, 'en')).toEqual(
    { kind: 'dictionary', word: 'Abana', title: 'Abana', source: dictionary }
  )
  expect(parseResourcePreviewLink({ href: 'Abana', type: '' }, undefined, 'en')).toBeUndefined()
})
it('distinguishes Strong references from dictionary words and keeps Strong language', () => {
  expect(
    parseResourcePreviewLink({ href: 'strong://h0123a', type: '' }, dictionary, 'en')
  ).toMatchObject({ kind: 'strong', code: 'H0123A', source: { kind: 'strong', language: 'en' } })
  expect(
    parseResourcePreviewLink(
      { href: 'strong://G0026', type: '' },
      { kind: 'strong', language: 'fr' },
      'en'
    )?.source.language
  ).toBe('fr')
})
it('recognizes Nave topic links only with their source context', () => {
  expect(
    parseResourcePreviewLink({ href: 'w=amour', type: '' }, { kind: 'nave', language: 'fr' }, 'en')
  ).toMatchObject({ kind: 'nave', name: 'amour' })
  expect(parseResourcePreviewLink({ href: 'w=amour', type: '' }, dictionary, 'en')).toBeUndefined()
})
it.each([
  'https://example.com',
  'mailto:a@b.com',
  '#section',
  'javascript:alert(1)',
  'strong://invalid',
  'bible://John.3.16',
  'v=1-1-2',
])('does not reinterpret %s as a dictionary word', href => {
  expect(parseResourcePreviewLink({ href, type: '' }, dictionary, 'fr')).toBeUndefined()
})
it('does not reinterpret a malformed verse link as a dictionary term', () => {
  expect(
    parseResourcePreviewLink({ href: 'invalide', type: 'verse' }, dictionary, 'fr')
  ).toBeUndefined()
})
it('loads the requested dictionary source and returns its definition', async () => {
  const loadItem = jest.fn(async () => ({ word: 'Abana', definition: '<p>Un fleuve.</p>' }))
  const resources = { dictionary: { loadItem } } as unknown as Parameters<
    typeof loadResourcePreview
  >[1]
  const target = parseResourcePreviewLink({ href: 'Abana', type: '' }, dictionary, 'fr')!
  await expect(loadResourcePreview(target, resources)).resolves.toEqual({
    html: '<p>Un fleuve.</p>',
  })
  expect(loadItem).toHaveBeenCalledWith('Abana', 'fr', 'bost')
})

it('loads Nave content in the source language', async () => {
  const loadItem = jest.fn(async () => ({
    name: 'Love',
    normalizedName: 'love',
    description: '<p>Love</p>',
  }))
  const resources = { nave: { loadItem } } as unknown as Parameters<typeof loadResourcePreview>[1]
  const target = parseResourcePreviewLink(
    { href: 'w=love', type: '' },
    { kind: 'nave', language: 'en' },
    'fr'
  )!
  await expect(loadResourcePreview(target, resources)).resolves.toEqual({ html: '<p>Love</p>' })
  expect(loadItem).toHaveBeenCalledWith('love', 'en')
})
it('loads the exact Strong identity and its compact metadata', async () => {
  const loadEntry = jest.fn(async () => ({
    original: 'ἀγάπη',
    transliteration: 'agapē',
    gloss: 'amour',
    definitionHtml: '<p>Définition</p>',
  }))
  const resources = { strongLexicon: { loadEntry } } as unknown as Parameters<
    typeof loadResourcePreview
  >[1]
  const target = parseResourcePreviewLink({ href: 'strong://G0026', type: '' }, undefined, 'fr')!
  await expect(loadResourcePreview(target, resources)).resolves.toEqual({
    original: 'ἀγάπη',
    transliteration: 'agapē',
    gloss: 'amour',
    html: '<p>Définition</p>',
  })
  expect(loadEntry).toHaveBeenCalledWith({ kind: 'dstrong', code: 'G0026' }, 'fr')
})
