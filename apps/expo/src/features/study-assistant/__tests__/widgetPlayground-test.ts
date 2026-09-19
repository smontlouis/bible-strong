import { resolveWidgetStory, widgetExamples, widgetStories } from '../playground/catalog'

it('groups every playground state under exactly one widget story', () => {
  const stateIds = widgetStories.flatMap(story => story.states.map(state => state.exampleId))
  expect(widgetStories).toHaveLength(11)
  expect(stateIds).toHaveLength(widgetExamples.length)
  expect(new Set(stateIds).size).toBe(widgetExamples.length)
  expect(new Set(stateIds)).toEqual(new Set(widgetExamples.map(example => example.id)))
})

it('groups states by UI component and preserves legacy playground links', () => {
  const passages = widgetStories.find(story => story.id === 'passage-widget')
  expect(passages?.states).toEqual([
    { exampleId: 'passages', label: 'Passages' },
    { exampleId: 'translations', label: 'Traductions' },
  ])
  expect(widgetStories.find(story => story.id === 'verse-analysis-widget')?.states).toEqual([
    { exampleId: 'words', label: 'Mots du verset' },
  ])
  expect(resolveWidgetStory('passages')).toMatchObject({
    story: { id: 'passage-widget' },
    state: { exampleId: 'passages' },
    example: { id: 'passages' },
  })
  expect(resolveWidgetStory('present-study-widget', 'translations')).toMatchObject({
    story: { id: 'passage-widget' },
    state: { exampleId: 'translations' },
  })
  expect(resolveWidgetStory('present-study-widget', 'words')).toMatchObject({
    story: { id: 'verse-analysis-widget' },
    state: { exampleId: 'words' },
    example: { id: 'words' },
  })
})
