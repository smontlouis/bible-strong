import { searchCommentaries, searchTimeline } from '../catalogSearch'
import type { TimelineSection } from '~features/timeline/types'

jest.mock('@bible-strong/resource-catalog/commentaries', () => ({
  COMMENTARY_CATALOG: [
    {
      id: 'tyndale',
      shortName: 'Tyndale',
      title: 'Tyndale Study Bible',
      author: 'A. Author',
      languages: ['en', 'fr'],
      description: { fr: 'texte qui ne doit pas être indexé' },
    },
  ],
}))

it('searches commentary titles and authors, without indexing descriptions', () => {
  expect(searchCommentaries('tindel', 'fr')).toHaveLength(0)
  const results = searchCommentaries('tyndale study', 'fr')
  expect(results[0]).toMatchObject({
    id: 'commentary:tyndale:fr',
    tab: { type: 'commentary-resource', data: { projectionId: 'tyndale:fr' } },
  })
  expect(searchCommentaries('a. author', 'en')).toHaveLength(2)
  expect(searchCommentaries('indexé', 'fr')).toHaveLength(0)
})

const sections: TimelineSection[] = [
  {
    id: 'exodus',
    title: 'Exode',
    titleEn: 'Exodus',
    sectionTitle: 'Moïse',
    sectionTitleEn: 'Moses',
    image: '',
    description: '',
    descriptionEn: '',
    startYear: -1500,
    endYear: -1200,
    interval: 100,
    subTitle: '',
    subTitleEn: '',
    color: '',
    events: [
      {
        id: 1,
        title: 'Naissance de Moïse',
        titleEn: 'Birth of Moses',
        slug: 'moses',
        start: -1400,
        end: -1400,
        row: 0,
        type: 'major',
      },
    ],
  },
]

it('lists periods on empty search, and distinguishes events from periods', () => {
  expect(searchTimeline(sections, '', 'fr')).toHaveLength(1)
  const results = searchTimeline(sections, 'moise', 'fr')
  expect(results).toHaveLength(2)
  expect(results[1]).toMatchObject({
    subtitle: 'Événement · Exode',
    tab: { type: 'timeline', data: { sectionIndex: 0, eventSlug: 'moses' } },
  })
  expect(searchTimeline(sections, 'birth', 'en')[0].title).toBe('Birth of Moses')
})
