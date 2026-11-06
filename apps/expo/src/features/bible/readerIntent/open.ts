import { getCommentaryByPublicationId } from '@bible-strong/resource-catalog/commentaries'
import { createReaderPreview } from '~features/bibleReferencePreview/readerPreview'
import {
  previewHistoryAtom,
  type PreviewRequest,
} from '~features/bibleReferencePreview/previewHistory'
import type { InlineCommentaryRequest } from '~features/commentaries/InlineCommentaryReader'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getNoteRoute } from '~features/notes/routeParams'
import { createVerseEndpoint, type RelationEndpoint } from '~features/studyRelations/domain'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'
import { getEntityRelationsRoute } from '~features/studyRelations/routeParams'
import { appLogger } from '~helpers/agentObservability'
import type { CanonicalBibleNote } from '~helpers/canonicalBibleNotes'
import { createStrongIdentity, type StrongIdentity } from '~helpers/strongIdentities'
import {
  createStrongSelection,
  getStrongSelectionPayload,
  type StrongSelection,
  type StrongSelectionMorphology,
} from '~helpers/strongSelection'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { getVersionOnScreen } from './columns'
import type { OpenedRelation, OpenIntent, OpenOrigin, OpenTarget, ReaderRule } from './types'
import type { Reader, ReaderSnapshot, ReaderWorld } from './world'

type OpenContext = { reader: Reader; snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string'

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(isText)

const ORIGINS: readonly OpenOrigin[] = [
  'text',
  'relation',
  'tag',
  'heading',
  'verse',
  'chapter-entities',
  'focus-study',
  'inline-commentary',
  'passage-media',
]

/** Only YouTube is a passage media source the reader leaves for. */
const MEDIA_SOURCE_PATTERN = /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i

/** A Relation endpoint the page names: its type and what identifies it, as the user data holds it. */
const decodeEndpoint = (value: unknown): RelationEndpoint | undefined => {
  if (!isRecord(value)) return undefined
  const endpoint = value as unknown as RelationEndpoint
  switch (value.type) {
    case 'verse':
      return isTextList(value.verseKeys) && isOptionalString(value.version) ? endpoint : undefined
    case 'note':
      return isText(value.noteId) ? endpoint : undefined
    case 'study':
      return isText(value.studyId) ? endpoint : undefined
    case 'strong':
      return isText(value.code) && (value.language === 'hebrew' || value.language === 'greek')
        ? endpoint
        : undefined
    case 'nave':
      return isText(value.nameLower) ? endpoint : undefined
    case 'dictionary':
    case 'word':
      return typeof value.word === 'string' ? endpoint : undefined
    case 'externalLink':
      return typeof value.linkId === 'string' && typeof value.url === 'string'
        ? endpoint
        : undefined
    case 'annotation':
      return isText(value.annotationId) ? endpoint : undefined
    default:
      return undefined
  }
}

const decodeRelation = (value: unknown): OpenedRelation | undefined => {
  if (!isRecord(value) || typeof value.targetExists !== 'boolean') return undefined
  if (!Array.isArray(value.verseIds) || !value.verseIds.every(isText)) return undefined
  const activeEndpoint =
    value.activeEndpoint === undefined ? undefined : decodeEndpoint(value.activeEndpoint)
  if (value.activeEndpoint !== undefined && !activeEndpoint) return undefined
  return { activeEndpoint, verseIds: value.verseIds, targetExists: value.targetExists }
}

/** The verse touched, as numbers: `book-chapter-verse`. */
const parseVerseKey = (verseKey: string | undefined) => {
  const [book, chapter, verse] = (verseKey ?? '').split('-').map(Number)
  return { book, chapter, verse }
}

const getStrongWordSelection = (
  target: Extract<OpenTarget, { kind: 'strong-word' }>,
  intent: Pick<OpenIntent, 'verseKey' | 'version'>
): StrongSelection | undefined => {
  const { book, chapter, verse } = parseVerseKey(intent.verseKey)
  return getStrongSelectionPayload({
    identities: target.identities,
    morphologies: target.morphologies,
    word: target.word,
    occurrenceId: target.occurrenceId,
    book,
    chapter,
    verse,
    version: intent.version,
  })
}

const decodeCanonicalNote = (value: unknown): CanonicalBibleNote | undefined =>
  isRecord(value) &&
  typeof value.offset === 'number' &&
  typeof value.order === 'number' &&
  value.kind === 'note' &&
  typeof value.markup === 'string'
    ? { offset: value.offset, order: value.order, kind: 'note', markup: value.markup }
    : undefined

const decodeTarget = (value: unknown): OpenTarget | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'endpoint': {
      const endpoint = decodeEndpoint(value.endpoint)
      if (!endpoint) return undefined
      if (value.relation === undefined) return { kind: 'endpoint', endpoint }
      const relation = decodeRelation(value.relation)
      return relation ? { kind: 'endpoint', endpoint, relation } : undefined
    }
    case 'strong-word':
      if (!Array.isArray(value.identities)) return undefined
      if (!isOptionalString(value.word) || !isOptionalString(value.occurrenceId)) return undefined
      if (value.morphologies !== undefined && !Array.isArray(value.morphologies)) return undefined
      return {
        kind: 'strong-word',
        identities: value.identities as StrongIdentity[],
        ...(value.morphologies !== undefined && {
          morphologies: value.morphologies as StrongSelectionMorphology[],
        }),
        ...(value.word !== undefined && { word: value.word as string }),
        ...(value.occurrenceId !== undefined && { occurrenceId: value.occurrenceId as string }),
      }
    case 'biblical-entity':
      return isText(value.entityKey) ? { kind: value.kind, entityKey: value.entityKey } : undefined
    case 'map':
      return isTextList(value.places) ? { kind: value.kind, places: value.places } : undefined
    case 'tag':
      return isText(value.tagId) ? { kind: value.kind, tagId: value.tagId } : undefined
    case 'pericopes':
      return { kind: value.kind }
    case 'commentary-section':
      return isText(value.resourceId) &&
        isText(value.language) &&
        isText(value.revision) &&
        isText(value.sectionId)
        ? {
            kind: value.kind,
            resourceId: value.resourceId,
            language: value.language,
            revision: value.revision,
            sectionId: value.sectionId,
          }
        : undefined
    case 'canonical-note': {
      const note = decodeCanonicalNote(value.note)
      return note ? { kind: value.kind, note } : undefined
    }
    case 'media-source':
      return isText(value.url) ? { kind: value.kind, url: value.url } : undefined
    case 'verse-resource':
      return value.resource === 'strong'
        ? { kind: value.kind, resource: value.resource }
        : undefined
    default:
      return undefined
  }
}

export const decodeOpenIntent = (value: unknown): OpenIntent | undefined => {
  if (!isRecord(value) || value.kind !== 'open') return undefined
  if (!ORIGINS.includes(value.origin as OpenOrigin)) return undefined
  if (!isOptionalString(value.verseKey) || !isOptionalString(value.version)) return undefined
  const target = decodeTarget(value.target)
  if (!target) return undefined
  const intent: OpenIntent = {
    kind: 'open',
    target,
    origin: value.origin as OpenOrigin,
    ...(value.verseKey !== undefined && { verseKey: value.verseKey as string }),
    ...(value.version !== undefined && { version: value.version as string }),
  }
  // A word of the text and a resource of a verse need the verse they were touched in.
  if (target.kind === 'strong-word' && !getStrongWordSelection(target, intent)) return undefined
  if (target.kind === 'verse-resource' && !intent.verseKey) return undefined
  return intent
}

/** The study objects the user owns: opening one, or a Relation, is personal Bible data. */
const PERSONAL_ENDPOINT_TYPES = new Set<RelationEndpoint['type']>([
  'note',
  'externalLink',
  'study',
  'annotation',
])

const opensPersonalData = ({ target, origin }: OpenIntent) =>
  origin === 'relation' ||
  target.kind === 'tag' ||
  (target.kind === 'endpoint' &&
    (Boolean(target.relation) || PERSONAL_ENDPOINT_TYPES.has(target.endpoint.type)))

/** The rule refusing an open intent, checked before any effect. */
export const getOpenRefusal = (
  intent: OpenIntent,
  { snapshot }: Pick<OpenContext, 'snapshot'>
): ReaderRule | undefined => {
  if (snapshot.hidesPersonalData && opensPersonalData(intent)) return 'personal-data'
  if (intent.target.kind === 'media-source' && !MEDIA_SOURCE_PATTERN.test(intent.target.url)) {
    return 'unknown-media-source'
  }
  return undefined
}

const getTabData = ({ snapshot, world }: Omit<OpenContext, 'reader'>) =>
  world.store.get(snapshot.tabAtom).data

/** The web shows a preview of what the native application opens as a page. */
const previewOrOpen = (
  { world }: Pick<OpenContext, 'world'>,
  request: PreviewRequest | undefined,
  open: () => void
) => {
  if (world.platform === 'web' && request) {
    world.store.set(previewHistoryAtom, [request])
    return
  }
  open()
}

const previewEndpointOrOpen = (
  context: Omit<OpenContext, 'reader'>,
  endpoint: RelationEndpoint,
  open: () => void
) => {
  const { world } = context
  const languages = world.store.get(resourcesLanguageAtom)
  const request = createReaderPreview(
    endpoint,
    getTabData(context).selectedVersion,
    world.t('Note'),
    open,
    { nave: languages.NAVE, dictionary: languages.DICTIONNAIRE }
  )
  previewOrOpen(context, request, open)
}

/** A Strong relation, like a word of the text, opens the Strong sheet over the reading. */
const openStrongSheet = (
  { reader, snapshot, world }: OpenContext,
  endpoint: Extract<RelationEndpoint, { type: 'strong' }>
) => {
  const selection = createStrongSelection(
    [{ kind: 'strong', code: endpoint.code }],
    endpoint.language === 'hebrew' ? 1 : 40,
    getTabData({ snapshot, world }).selectedVersion
  )
  if (selection) reader.surface({ kind: 'strong-selection', selection })
}

/** A Strong code of the passage media leaves the reading for the Strong page. */
const openStrongPage = (
  context: Omit<OpenContext, 'reader'>,
  endpoint: Extract<RelationEndpoint, { type: 'strong' }>
) => {
  const data = getTabData(context)
  const identity = createStrongIdentity(endpoint.code, endpoint.language)
  context.world.navigate(
    createStrongDetailRoute('index', {
      book: endpoint.language === 'greek' ? 40 : 1,
      reference: identity.code,
      identityKind: identity.kind,
      identityCode: identity.code,
      bibleVersion: data.selectedVersion,
      bibleChapter: data.selectedChapter,
    })
  )
}

const openNote = (context: Omit<OpenContext, 'reader'>, noteId: string, verseIds?: string[]) => {
  const { world } = context
  const open = () =>
    world.navigate(
      getNoteRoute({ noteId, verseKeys: verseIds, version: getTabData(context).selectedVersion })
    )
  previewEndpointOrOpen(context, { type: 'note', noteId }, open)
}

const openLink = ({ world }: Pick<OpenContext, 'world'>, linkId: string) => {
  const open = () => world.navigate({ pathname: '/link', params: { linkId } })
  previewOrOpen({ world }, { kind: 'link', linkId, title: world.t('Lien'), open }, open)
}

/** Any other endpoint: the Strong sheet for a Strong entry, its preview or its page otherwise. */
const openRelatedEndpoint = (context: OpenContext, endpoint: RelationEndpoint) => {
  if (endpoint.type === 'strong') {
    openStrongSheet(context, endpoint)
    return
  }
  previewEndpointOrOpen(context, endpoint, () => context.world.openStudyObject(endpoint))
}

/** The Relations of what the reader stands on, where a Relation whose target is gone can go. */
const openRelations = (context: Omit<OpenContext, 'reader'>, relation: OpenedRelation) => {
  const endpoint =
    relation.activeEndpoint ??
    createVerseEndpoint(relation.verseIds, undefined, getTabData(context).selectedVersion)
  context.world.navigate(getEntityRelationsRoute(endpoint))
}

/** What a Relation leads to, or the list of the Relations when its target is gone. */
const openRelationTarget = (
  context: OpenContext,
  endpoint: RelationEndpoint,
  relation: OpenedRelation
) => {
  const { world } = context
  const isAvailable =
    relation.targetExists || (endpoint.type !== 'note' && endpoint.type !== 'annotation')
  switch (endpoint.type) {
    case 'note':
      if (!relation.targetExists) {
        world.notify({
          type: 'warning',
          message: world.t("Cette note n'existe plus. Vous pouvez supprimer la relation."),
        })
        openRelations(context, relation)
        return
      }
      openNote(context, endpoint.noteId, relation.verseIds)
      return
    case 'externalLink':
      if (relation.targetExists && endpoint.linkId) {
        openLink(context, endpoint.linkId)
        return
      }
      if (isAvailable) openRelatedEndpoint(context, endpoint)
      else openRelations(context, relation)
      return
    default:
      if (isAvailable) openRelatedEndpoint(context, endpoint)
      else openRelations(context, relation)
  }
}

const openEndpoint = (
  context: OpenContext,
  intent: OpenIntent,
  { endpoint, relation }: Extract<OpenTarget, { kind: 'endpoint' }>
) => {
  if (relation) {
    openRelationTarget(context, endpoint, relation)
    return
  }
  const data = getTabData(context)
  switch (endpoint.type) {
    case 'strong':
      if (intent.origin === 'passage-media') openStrongPage(context, endpoint)
      else openStrongSheet(context, endpoint)
      return
    case 'note':
      openNote(context, endpoint.noteId)
      return
    case 'verse':
      // A verse opens focused, in the version of the reading unless the endpoint names one.
      context.world.navigate({
        pathname: '/bible-view',
        params: getBibleViewParamsForVerseKeys(
          endpoint.verseKeys,
          endpoint.version ?? data.selectedVersion
        ),
      })
      return
    default:
      openRelatedEndpoint(context, endpoint)
  }
}

const openCommentarySection = (
  context: OpenContext,
  target: Extract<OpenTarget, { kind: 'commentary-section' }>
) => {
  const { snapshot, world } = context
  const { chips, indexes } = snapshot.inlineCommentaries
  const chip = chips.find(
    candidate =>
      candidate.sectionId === target.sectionId &&
      candidate.resourceId === target.resourceId &&
      candidate.language === target.language &&
      candidate.revision === target.revision
  )
  if (!chip) return
  const entry = getCommentaryByPublicationId(chip.resourceId, chip.language)
  if (!entry) return
  const data = getTabData(context)
  const book = data.selectedBook.Numero
  const chapter = data.selectedChapter
  const open = (sectionId?: string) =>
    world.navigate({
      pathname: '/commentary-entry',
      params: {
        projectionId: `${entry.id}:${chip.language}`,
        book: String(book),
        chapter: String(chapter),
        sectionId: sectionId === undefined ? chip.sectionId : sectionId,
      },
    })
  if (world.platform !== 'web') {
    open()
    return
  }
  const index = indexes.find(
    item =>
      item.resource.resourceId === chip.resourceId &&
      item.resource.language === chip.language &&
      item.resource.revision === chip.revision
  )
  const request: InlineCommentaryRequest = {
    resourceId: chip.resourceId,
    language: chip.language,
    revision: chip.revision,
    book,
    chapter,
    sectionId: chip.sectionId,
    sections:
      index?.sections.map(section => ({
        sectionId: section.id,
        rangeStartVerse: section.rangeStartVerse,
        rangeEndVerse: section.rangeEndVerse,
        excerpt: section.excerpt,
      })) ?? chip.sections,
    excerpt: chip.excerpt,
  }
  world.store.set(previewHistoryAtom, [
    { kind: 'commentary', title: entry.shortName, request, open },
  ])
}

export const applyOpenIntent = async (intent: OpenIntent, context: OpenContext) => {
  const { reader, snapshot, world } = context
  const { target } = intent
  const data = getTabData(context)
  switch (target.kind) {
    case 'endpoint':
      openEndpoint(context, intent, target)
      return
    case 'strong-word': {
      const selection = getStrongWordSelection(target, intent)
      if (selection) reader.surface({ kind: 'strong-selection', selection })
      return
    }
    case 'biblical-entity':
      world.navigate(
        createStrongDetailRoute(
          'entity',
          {
            book: data.selectedBook.Numero,
            bibleVersion: data.selectedVersion,
            bibleChapter: data.selectedChapter,
          },
          { entityKey: target.entityKey }
        )
      )
      return
    case 'map':
      world.navigate({
        pathname: '/strong/map',
        params: {
          places: target.places.join(','),
          title: `${world.t(data.selectedBook.Nom)} ${data.selectedChapter}`,
        },
      })
      return
    case 'tag':
      world.navigate({ pathname: '/tag', params: { tagId: target.tagId } })
      return
    case 'pericopes':
      world.navigate({
        pathname: '/pericope',
        params: { book: String(data.selectedBook.Numero), version: data.selectedVersion },
      })
      return
    case 'commentary-section':
      openCommentarySection(context, target)
      return
    case 'canonical-note':
      reader.surface({ kind: 'canonical-note', note: target.note })
      return
    case 'media-source':
      try {
        await world.openUrl(target.url)
      } catch (error) {
        appLogger.captureError('webview', 'passage_media.open_source_failed', error, {
          sourceUrl: target.url,
        })
        world.notify({ type: 'error', message: world.t('bible.passageMedia.openFailed') })
      }
      return
    case 'verse-resource':
      reader.surface({
        kind: 'verse-resource',
        resource: target.resource,
        verseKey: intent.verseKey!,
        version: getVersionOnScreen(snapshot, data.selectedVersion, intent.version),
      })
      return
  }
}
