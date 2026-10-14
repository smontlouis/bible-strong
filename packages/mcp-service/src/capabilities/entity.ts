import type {
  StrongLexiconChapterEntitiesResponseDto,
  StrongLexiconEntityResponseDto,
  StrongLexiconEntryDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import * as z from 'zod/v4'
import { entityBookCode } from '../bible/books'
import { findReferences, formatPassage } from '../bible/reference'
import type { EntityCard } from '../cards/types'
import type { StudyLanguage } from '../language'
import {
  blocksToText,
  editorialLinks,
  htmlToBlocks,
  truncateText,
  withReferences,
} from '../richText'
import { parseStrongCode } from '../strong/codes'
import { findLexiconEntries } from '../strong/search'
import {
  languageInput,
  lines,
  referenceInput,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'
import { requirePassages } from './passage'

type Entity = StrongLexiconEntityResponseDto['entity']

const ARTICLE_LENGTH = 5000
const MAX_RELATIONS = 24

const RELATIONS: Record<string, Record<StudyLanguage, string>> = {
  father: { fr: 'Père', en: 'Father' },
  mother: { fr: 'Mère', en: 'Mother' },
  partner: { fr: 'Conjoint', en: 'Partner' },
  sibling: { fr: 'Frère ou sœur', en: 'Sibling' },
  offspring: { fr: 'Enfant', en: 'Child' },
}

const relationLabel = (relation: string, language: StudyLanguage): string =>
  RELATIONS[relation]?.[language] ?? relation.replaceAll('_', ' ')

const categoryOf = (category: string): EntityCard['category'] =>
  category === 'person' || category === 'place' || category === 'group' ? category : 'other'

// --- A person, a place ---------------------------------------------------------------

export const entityInput = {
  name: z
    .string()
    .min(2)
    .max(120)
    .describe(
      'The person, place or people to read about: a name ("Abraham", "Béthel") or the ' +
        '`entity` identity returned by list_chapter_people_and_places or another call ' +
        '("Abraham@Gen.11.26-1Pe").'
    ),
  language: languageInput,
}

export const entityOutput = z.object({
  entity: z.string().describe('The identity of the person or place, for other calls.'),
  name: z.string(),
  kind: z.enum(['person', 'place', 'group', 'other']),
  brief: z.string(),
  description: z.string(),
  strongNumbers: z.array(z.string()).describe('The Hebrew or Greek names it is written by.'),
  place: z
    .object({
      area: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  relations: z.array(
    z.object({ relation: z.string(), name: z.string(), entity: z.string().optional() })
  ),
  url: z.string().optional(),
})

const readEntity = (context: StudyContext, language: StudyLanguage, uniqueName: string) =>
  context.api.get<StrongLexiconEntityResponseDto>(
    `/v1/strong-lexicon/entities/${encodeURIComponent(uniqueName)}`,
    { language }
  )

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/**
 * Finds who a name is: the lexicon files a person under the Hebrew or Greek word that
 * names them, so the name is looked up there and the entry says who it names.
 */
const findEntity = async (
  context: StudyContext,
  language: StudyLanguage,
  name: string
): Promise<Entity | undefined> => {
  const wanted = normalize(name)
  // The entries glossed by the very name come first.
  const candidates = await findLexiconEntries(context.api, { query: name, language, limit: 6 })
  const entries = await Promise.all(
    candidates.map(candidate =>
      context.api
        .get<StrongLexiconEntryDto>(
          `/v1/strong-lexicon/entries/${encodeURIComponent(candidate.stepCode)}`,
          { language }
        )
        .catch(() => undefined)
    )
  )
  const entities = entries.flatMap(entry => (entry?.entity ? [entry.entity] : []))
  return entities.find(entity => normalize(entity.name) === wanted) ?? entities[0]
}

export const loadEntity = async (
  context: StudyContext,
  input: { name: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof entityOutput>>> => {
  const language = input.language ?? context.language
  const asked = input.name.trim()
  // An identity carries the passage the person first appears in: `Adam@Gen.2.19-Jud`.
  const entity = asked.includes('@')
    ? (await readEntity(context, language, asked))?.entity
    : await findEntity(context, language, asked)
  if (!entity) {
    throw new StudyError(
      `The lexicon of people and places has no "${asked}". ` +
        'list_chapter_people_and_places names the ones of a chapter.'
    )
  }

  // The lexicon marks the paragraphs of an article with pilcrows.
  const article = entity.articleHtml || entity.summaryHtml || entity.description
  const body = withReferences(
    htmlToBlocks(
      article
        .split('¶')
        .map(paragraph => `<p>${paragraph}</p>`)
        .join(''),
      editorialLinks()
    ),
    text => findReferences(text, language)
  )
  const codes = entity.strongCodes.flatMap(value => {
    const code = parseStrongCode(value)
    return code ? [{ code: code.code, label: code.label }] : []
  })
  const relations = entity.relations.slice(0, MAX_RELATIONS).map(relation => ({
    label: relationLabel(relation.relation, language),
    name: relation.targetName,
    ...(relation.targetUniqueName ? { uniqueName: relation.targetUniqueName } : {}),
  }))
  const brief = entity.brief || entity.shortDescription
  // A person has no page of their own on the site: the entry of their name holds them.
  const url = codes[0] ? context.links.strong(language, codes[0].code) : undefined
  const place = entity.place
    ? {
        area: entity.place.area,
        ...(entity.place.latitude !== undefined ? { latitude: entity.place.latitude } : {}),
        ...(entity.place.longitude !== undefined ? { longitude: entity.place.longitude } : {}),
      }
    : undefined

  const card: EntityCard = {
    kind: 'entity',
    language,
    title: entity.name,
    uniqueName: entity.uniqueName,
    category: categoryOf(entity.category),
    brief,
    body,
    ...(place ? { place } : {}),
    relations,
    codes,
    url,
  }

  const description = truncateText(blocksToText(body), ARTICLE_LENGTH)
  return {
    text: lines(
      `${entity.name} — ${brief}`,
      '',
      description,
      '',
      place?.area ? `Area: ${place.area}` : undefined,
      place?.latitude !== undefined && place.longitude !== undefined
        ? `Coordinates: ${place.latitude}, ${place.longitude}`
        : undefined,
      relations.length
        ? `Relations: ${relations.map(relation => `${relation.label}: ${relation.name}`).join('; ')}`
        : undefined,
      codes.length ? `Strong numbers: ${codes.map(code => code.code).join(', ')}` : undefined,
      sourceLine(url)
    ),
    model: {
      entity: entity.uniqueName,
      name: entity.name,
      kind: card.category,
      brief,
      description,
      strongNumbers: codes.map(code => code.code),
      ...(place ? { place } : {}),
      relations: relations.map(relation => ({
        relation: relation.label,
        name: relation.name,
        ...(relation.uniqueName ? { entity: relation.uniqueName } : {}),
      })),
      url,
    },
    card,
  }
}

// --- The people and places of a chapter ------------------------------------------------

export const chapterEntitiesInput = {
  reference: referenceInput('The chapter whose people and places to list'),
  language: languageInput,
}

export const chapterEntitiesOutput = z.object({
  chapter: z.string(),
  entities: z.array(
    z.object({
      entity: z.string().describe('The identity of the person or place, for get_person_or_place.'),
      name: z.string(),
      kind: z.string(),
      verses: z.array(z.number()),
    })
  ),
})

export const loadChapterEntities = async (
  context: StudyContext,
  input: { reference: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof chapterEntitiesOutput>>> => {
  const language = input.language ?? context.language
  const passage = { ...requirePassages(input.reference, language)[0]!, wholeChapter: true }
  const bookCode = entityBookCode(passage.book)
  const chapter = formatPassage(passage, language)
  const response = bookCode
    ? await context.api.get<StrongLexiconChapterEntitiesResponseDto>(
        `/v1/strong-lexicon/entities/chapters/${bookCode}/${passage.chapter}`,
        { language }
      )
    : undefined
  const entities = (response?.entities ?? []).map(entity => ({
    entity: entity.uniqueName,
    name: entity.name,
    kind: entity.category,
    verses: [...entity.verses],
  }))
  return {
    text: entities.length
      ? lines(
          `People and places of ${chapter}:`,
          ...entities.map(
            entity =>
              `${entity.name} (${entity.kind}) — v. ${entity.verses.join(', ')} [${entity.entity}]`
          )
        )
      : `No person or place is listed for ${chapter}.`,
    model: { chapter, entities },
  }
}
