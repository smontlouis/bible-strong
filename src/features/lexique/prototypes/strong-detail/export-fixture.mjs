/**
 * PROTOTYPE ONLY — exports one resolved Strong detail fixture from the real modular databases.
 * Question: how should a dense Strong detail page organize its information?
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const prototypeDirectory = dirname(fileURLToPath(import.meta.url))
const makerRoot = resolve(process.cwd(), '../bible-lexicon-maker')
const releaseRoot = resolve(makerRoot, 'outputs/releases/strong-lexicon-modular-v1-candidate')
const referencesPath = resolve(
  makerRoot,
  'outputs/strong-references-jsonl-step-ctb-v2/bible-sg1910-strong.jsonl'
)
const corePath = resolve(releaseRoot, 'strong_lexicon.core.sqlite')
const resourcesPath = resolve(releaseRoot, 'strong_lexicon.resources.sqlite')
const entitiesPath = resolve(releaseRoot, 'bible_entities.sqlite')

const query = (database, sql) => {
  const output = execFileSync('sqlite3', ['-json', database, sql], {
    encoding: 'utf8',
  }).trim()
  return output ? JSON.parse(output) : []
}

const [entry] = query(
  corePath,
  `
    SELECT e.*, i.stepCode,
           tr.gloss AS localizedGloss,
           tr.meaning AS localizedMeaning,
           tr.meaningHtml AS localizedMeaningHtml
      FROM StepEntries e
      JOIN StepEntryIdentities i ON i.stepEntryId=e.id
      LEFT JOIN LexiconTranslations tr
        ON tr.stepEntryId=e.id AND tr.language='fr'
     WHERE i.stepCode='G4074G'
     LIMIT 1
  `
)

const [morphology] = query(
  corePath,
  `
    SELECT m.code, m.meaning, m.description,
           tr.meaning AS localizedMeaning,
           tr.description AS localizedDescription
      FROM MorphologyCodes m
      LEFT JOIN MorphologyCodeTranslations tr
        ON tr.morphologyCodeId=m.id AND tr.language='fr'
     WHERE m.scope='lexical_brief'
       AND (m.code='${entry.morph}' OR m.normalizedCode='${entry.morph}')
     ORDER BY CASE WHEN m.code='${entry.morph}' THEN 0 ELSE 1 END, m.id
     LIMIT 1
  `
)

const relations = query(
  corePath,
  `
    SELECT r.groupKind, k.labelFr AS label, r.toStepCode AS stepCode,
           COALESCE(tr.gloss, target.gloss) AS gloss,
           target.original, target.transliteration
      FROM LexiconRelations r
      JOIN RelationKinds k ON k.id=r.relationKindId
      LEFT JOIN StepEntries target ON target.id=r.toStepEntryId
      LEFT JOIN LexiconTranslations tr
        ON tr.stepEntryId=target.id AND tr.language='fr'
     WHERE r.fromStepEntryId=${entry.id}
     ORDER BY r.groupKind, r.sortOrder
  `
)

const resources = query(
  resourcesPath,
  `
    SELECT r.id, r.source, r.kind,
           COALESCE(tr.contentHtml, r.contentHtml) AS contentHtml
      FROM LexiconResources r
      LEFT JOIN LexiconResourceTranslations tr
        ON tr.resourceId=r.id AND tr.language='fr'
     WHERE r.stepEntryId=${entry.id}
     ORDER BY r.id
  `
)

const [entity] = query(
  entitiesPath,
  `
    SELECT e.id, e.uStrong, e.category, e.type,
           COALESCE(tr.displayName, e.displayName) AS name,
           COALESCE(tr.description, e.description) AS description,
           COALESCE(tr.shortDescription, e.shortDescription) AS shortDescription,
           COALESCE(tr.summaryHtml, e.summaryHtml) AS summaryHtml,
           COALESCE(tr.brief, e.brief) AS brief,
           COALESCE(tr.articleHtml, e.articleHtml) AS articleHtml
      FROM Entities e
      LEFT JOIN EntityTranslations tr
        ON tr.entityId=e.id AND tr.language='fr'
     WHERE e.uStrong='${entry.uStrong}'
     ORDER BY e.id
     LIMIT 1
  `
)

const entityRelations = query(
  entitiesPath,
  `
    SELECT r.relation, r.certainty,
           target.uStrong AS targetUStrong,
           target.type AS targetSex,
           COALESCE(tr.displayName, target.displayName, r.toUniqueName) AS targetName
      FROM EntityRelations r
      LEFT JOIN Entities target ON target.id=r.toEntityId
      LEFT JOIN EntityTranslations tr
        ON tr.entityId=target.id AND tr.language='fr'
     WHERE r.fromEntityId=${entity.id}
     ORDER BY r.relation, targetName
  `
)

const entityNames = query(
  entitiesPath,
  `
    SELECT significance, dStrong, eStrong, original, displayName, refsText
      FROM EntityNames
     WHERE entityId=${entity.id}
     ORDER BY displayName
  `
)

const entityReferences = query(
  entitiesPath,
  `
    SELECT refText
      FROM EntityRefs
     WHERE entityId=${entity.id}
     ORDER BY book, chapter, verse, suffix
  `
).map(({ refText }) => refText)

const stripTags = value =>
  value
    .replace(/<w\b[^>]*>/giu, '')
    .replace(/<\/w>/giu, '')
    .replace(/<\/?p>/giu, '')
    .replace(/<\/?divineName>/giu, '')
    .replace(/\s+/gu, ' ')
    .trim()

const verseRows = readFileSync(referencesPath, 'utf8')
  .trim()
  .split('\n')
  .map(line => JSON.parse(line))

const occurrenceRows = verseRows.filter(row => /dstrong="G4074G"/u.test(row.text))
const selectedVerse = occurrenceRows.find(row => row.ref === 'Matt.16.16')
const occurrenceSample = occurrenceRows.slice(0, 12).map(row => ({
  reference: row.ref,
  text: stripTags(row.text),
}))

const fixture = {
  prototype: {
    question: 'Comment hiérarchiser la fiche détaillée d’un Strong sans répétitions ?',
    databaseRelease: 'strong-lexicon-modular-v1-candidate',
  },
  context: {
    version: selectedVerse.version,
    reference: 'Matthieu 16:16',
    osisReference: selectedVerse.ref,
    selectedText: 'Pierre',
    verseText: stripTags(selectedVerse.text),
    token: {
      strong: 'G4074',
      dStrong: 'G4074G',
      resolvedUStrong: entry.uStrong,
      lemma: 'Pierre',
      partOfSpeech: 'Nom propre',
      morphology: {
        code: entry.morph,
        meaning: morphology?.localizedMeaning || morphology?.meaning || entry.morph,
      },
    },
  },
  entry: {
    id: entry.id,
    language: entry.language,
    stepCode: entry.stepCode,
    classicStrong: `G${String(entry.baseCode).padStart(4, '0')}`,
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    pronunciation: entry.pronunciation,
    gloss: entry.localizedGloss || entry.gloss,
    definitionHtml: entry.localizedMeaningHtml || entry.meaning,
    morphology: {
      code: entry.morph,
      meaning: morphology?.localizedMeaning || morphology?.meaning || entry.morph,
      description: morphology?.localizedDescription || morphology?.description || '',
    },
    relations,
    resources: resources.map(resource => ({
      ...resource,
      title: 'Dictionnaire grec détaillé',
    })),
    entity: {
      ...entity,
      relations: entityRelations,
      names: entityNames,
      references: entityReferences,
      referenceCount: entityReferences.length,
    },
  },
  concordance: {
    version: 'SG1910',
    identity: { kind: 'dstrong', code: 'G4074G' },
    count: occurrenceRows.length,
    lemmas: [
      { id: 'proper-name', lemma: 'Pierre', occurrenceCount: 146 },
      { id: 'common-noun', lemma: 'pierre', occurrenceCount: 7 },
    ],
    sample: occurrenceSample,
  },
}

writeFileSync(
  resolve(prototypeDirectory, 'strong-detail.fixture.json'),
  `${JSON.stringify(fixture, null, 2)}\n`
)

console.log(
  `Fixture generated: ${fixture.entry.stepCode}, ${fixture.concordance.count} occurrences, ${fixture.entry.entity.referenceCount} entity references`
)
