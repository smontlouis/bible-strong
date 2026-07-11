import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import {
  defaultTagListQueryState,
  migrateTagListQueryState,
  type TagListQueryState,
} from '~features/entityListQuery/tagListQueryState'
import type { EntityListSort } from '~features/entityListQuery/entityListQuery'
import type { HighlightFilters } from '~common/types'

export {
  defaultTagListQueryState,
  migrateTagListQueryState,
  type TagListQueryState,
  type TagListSort,
} from '~features/entityListQuery/tagListQueryState'

export const tagListQueryAtom = atomWithAsyncStorage<TagListQueryState>(
  'entityListFilters.tags.v1',
  defaultTagListQueryState,
  { migrate: migrateTagListQueryState }
)

export type BasicEntityListQueryState = {
  query: string
  sort: EntityListSort
  tagId: string | null
}

export type StudiesListQueryState = BasicEntityListQueryState & {
  publication: 'all' | 'draft' | 'published'
}

export type LinksListQueryState = BasicEntityListQueryState & {
  linkType: string | null
}

const createBasicState = (sort: EntityListSort): BasicEntityListQueryState => ({
  query: '',
  sort,
  tagId: null,
})

const createBasicMigration = (fallbackSort: EntityListSort) => (value: unknown) => {
  const fallback = createBasicState(fallbackSort)
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<BasicEntityListQueryState>
  const sorts: EntityListSort[] = [
    'newest',
    'oldest',
    'title-asc',
    'title-desc',
    'created-newest',
    'created-oldest',
  ]
  return {
    query: typeof candidate.query === 'string' ? candidate.query : '',
    sort: sorts.includes(candidate.sort as EntityListSort)
      ? (candidate.sort as EntityListSort)
      : fallbackSort,
    tagId: typeof candidate.tagId === 'string' ? candidate.tagId : null,
  }
}

export const defaultNotesListQueryState = createBasicState('newest')
export const defaultStudiesListQueryState: StudiesListQueryState = {
  ...createBasicState('newest'),
  publication: 'all',
}
export const defaultLinksListQueryState: LinksListQueryState = {
  ...createBasicState('newest'),
  linkType: null,
}

export const notesListQueryAtom = atomWithAsyncStorage(
  'entityListFilters.notes.v1',
  defaultNotesListQueryState,
  { migrate: createBasicMigration('newest') }
)
export const studiesListQueryAtom = atomWithAsyncStorage<StudiesListQueryState>(
  'entityListFilters.studies.v1',
  defaultStudiesListQueryState,
  {
    migrate: value => {
      const basic = createBasicMigration('newest')(value)
      const publication =
        value &&
        typeof value === 'object' &&
        ['all', 'draft', 'published'].includes(
          String((value as Partial<StudiesListQueryState>).publication)
        )
          ? ((value as Partial<StudiesListQueryState>)
              .publication as StudiesListQueryState['publication'])
          : 'all'
      return { ...basic, publication }
    },
  }
)
export const linksListQueryAtom = atomWithAsyncStorage<LinksListQueryState>(
  'entityListFilters.links.v1',
  defaultLinksListQueryState,
  {
    migrate: value => ({
      ...createBasicMigration('newest')(value),
      linkType:
        value &&
        typeof value === 'object' &&
        typeof (value as LinksListQueryState).linkType === 'string'
          ? (value as LinksListQueryState).linkType
          : null,
    }),
  }
)

export const highlightsListQueryAtom = atomWithAsyncStorage<HighlightFilters>(
  'entityListFilters.highlights.v1',
  {},
  {
    migrate: value => {
      if (!value || typeof value !== 'object') return {}
      const candidate = value as HighlightFilters
      return {
        colorId: typeof candidate.colorId === 'string' ? candidate.colorId : undefined,
        tagId: typeof candidate.tagId === 'string' ? candidate.tagId : undefined,
        typeFilter: typeof candidate.typeFilter === 'string' ? candidate.typeFilter : undefined,
        testament: ['all', 'old', 'new'].includes(String(candidate.testament))
          ? candidate.testament
          : 'all',
        book: typeof candidate.book === 'number' ? candidate.book : undefined,
        sort: ['newest', 'oldest', 'bible'].includes(String(candidate.sort))
          ? candidate.sort
          : 'newest',
      }
    },
  }
)

export type WordAnnotationsListQueryState = {
  colorId: string | null
  tagId: string | null
  annotationType: 'background' | 'underline' | 'circle' | null
  version: string | null
  testament: 'all' | 'old' | 'new'
  book: number | null
  view: 'verse' | 'date' | 'flat'
  sort: 'newest' | 'oldest' | 'bible'
}

export const defaultWordAnnotationsListQueryState: WordAnnotationsListQueryState = {
  colorId: null,
  tagId: null,
  annotationType: null,
  version: null,
  testament: 'all',
  book: null,
  view: 'verse',
  sort: 'bible',
}

export const wordAnnotationsListQueryAtom = atomWithAsyncStorage<WordAnnotationsListQueryState>(
  'entityListFilters.wordAnnotations.v1',
  defaultWordAnnotationsListQueryState,
  {
    migrate: value => {
      if (!value || typeof value !== 'object') return defaultWordAnnotationsListQueryState
      const candidate = value as Partial<WordAnnotationsListQueryState>
      return {
        colorId: typeof candidate.colorId === 'string' ? candidate.colorId : null,
        tagId: typeof candidate.tagId === 'string' ? candidate.tagId : null,
        annotationType: ['background', 'underline', 'circle'].includes(
          String(candidate.annotationType)
        )
          ? (candidate.annotationType as WordAnnotationsListQueryState['annotationType'])
          : null,
        version: typeof candidate.version === 'string' ? candidate.version : null,
        testament: ['all', 'old', 'new'].includes(String(candidate.testament))
          ? (candidate.testament as WordAnnotationsListQueryState['testament'])
          : 'all',
        book: typeof candidate.book === 'number' ? candidate.book : null,
        view: ['verse', 'date', 'flat'].includes(String(candidate.view))
          ? (candidate.view as WordAnnotationsListQueryState['view'])
          : 'verse',
        sort: ['newest', 'oldest', 'bible'].includes(String(candidate.sort))
          ? (candidate.sort as WordAnnotationsListQueryState['sort'])
          : 'bible',
      }
    },
  }
)
