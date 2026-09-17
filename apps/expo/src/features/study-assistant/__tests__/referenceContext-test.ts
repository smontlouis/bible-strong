import { entityContext, timelineContext } from '../referenceContext'
it('publishes event identity, dates and references without extra data', () => {
  const event = {
    id: '1',
    slug: 'exodus',
    title: 'Exode',
    period: 'Exode',
    dates: 'Date approximative',
    description: 'Description',
    article: 'Article',
    scriptures: ['Ex.12'],
    related: [],
    images: [],
    videos: [],
    personalNote: 'PRIVATE',
  }
  const context = timelineContext(event, 'fr')!
  expect(context.kind).toBe('timeline')
  expect(context.detail).toContain('Date approximative')
  expect(context.content).toContain('Ex.12')
  expect(JSON.stringify(context)).not.toContain('PRIVATE')
  expect(timelineContext(event, 'en')?.key).not.toBe(context.key)
})
it('retains entity category and uncertain relationships, bounds article content', () => {
  const entity = {
    id: 1,
    uniqueName: 'jerusalem',
    name: 'Jérusalem',
    category: 'place',
    type: 'city',
    description: 'Ville',
    shortDescription: '',
    brief: '',
    summaryHtml: '',
    articleHtml: 'Texte',
    strongCodes: ['H3389'],
    relations: [{ relation: 'situé dans', targetName: 'Juda', certainty: 'possible' }],
    personalNote: 'PRIVATE',
  }
  const context = entityContext(entity, 'fr')!
  expect(context.kind).toBe('place')
  expect(context.content).toContain('possible')
  expect(JSON.stringify(context)).not.toContain('PRIVATE')
  expect(
    entityContext({ ...entity, articleHtml: 'x'.repeat(14000) }, 'fr')!.content!.length
  ).toBeLessThanOrEqual(12000)
  expect(entityContext(undefined, 'fr')).toBeNull()
  expect(timelineContext(undefined, 'fr')).toBeNull()
})
