import publishedExamples from './fixtures/strongDefinitionPresentation.json'
import { presentStrongDefinitions } from '../strongDefinitionPresentation'

const entry = {
  language: 'hebrew' as const,
  stepCode: 'H7819B',
  eStrong: 'H7819',
  classicStrong: 'H7819',
  gloss: '',
  definitionHtml: 'tuer abattre battre nourriture sacrifice abattage mot douteux',
  detailedDefinitionHtml: 'abattage mot douteux',
  relations: [],
}

const siblingRelation = {
  stepCode: 'H7819A',
  group: 'subentry' as const,
  relationKind: 'same_estrong',
  label: '',
  gloss: '',
  original: '',
  transliteration: '',
}
const specificSense = 'un homme de la tribu de Benjamin, fils de Saül et ami de David'

it('does not infer a specific sense from a suffix or a partial textual overlap alone', () => {
  expect(presentStrongDefinitions(entry)).toEqual({
    essentialHtml: entry.definitionHtml,
    deep: { kind: 'detailed', html: entry.detailedDefinitionHtml },
  })
})

it('prioritizes a distinct sense only with explicit sibling relations', () => {
  expect(
    presentStrongDefinitions({
      ...entry,
      detailedDefinitionHtml: specificSense,
      relations: [siblingRelation],
    })
  ).toEqual({
    essentialHtml: specificSense,
    deep: { kind: 'general', html: entry.definitionHtml },
  })
})

it('keeps the family definition first when the specific notice barely restates the gloss', () => {
  expect(
    presentStrongDefinitions({
      ...entry,
      stepCode: 'H0349A',
      eStrong: 'H0349a',
      classicStrong: 'H0349',
      gloss: 'comment ?',
      definitionHtml: '1) comment ? interj<br />2) comment! (en lamentation)',
      detailedDefinitionHtml: 'adv interrog.<br> comment ?',
    })
  ).toEqual({
    essentialHtml: '1) comment ? interj<br />2) comment! (en lamentation)',
    deep: { kind: 'detailed', html: 'adv interrog.<br> comment ?' },
  })
})

it('keeps the historical definition first for Greek siblings sharing one lexicon article', () => {
  // Abbott-Smith text published identically for G3972G and G3972H.
  const article =
    '<b>Παῦλος</b>, -ου, ὁ (lat. Paulus), <br><br>1. <b>Sergius Paulus</b>: Act.13:7. <br><br>2. <b>l’apôtre Paul</b> (cf. Σαῦλος) : Act.13:9'
  const historical =
    'Paul ou Paulus = "petit"<br>1) l’apôtre Paul<br>2) Sergius Paulus, proconsul de Chypre'
  expect(
    presentStrongDefinitions({
      ...entry,
      language: 'greek',
      stepCode: 'G3972G',
      eStrong: 'G3972',
      classicStrong: 'G3972',
      gloss: 'Paul',
      definitionHtml: historical,
      detailedDefinitionHtml: article,
      relations: [{ ...siblingRelation, stepCode: 'G3972H' }],
    })
  ).toEqual({ essentialHtml: historical, deep: { kind: 'detailed', html: article } })
})

it('reads a near duplicate once, in its richer detailed wording', () => {
  const simple = 'serpent reptile serpent image du serpent serpent volant mythologique'
  const detailed = 'serpent serpent image de serpent serpent fuyard mythologique'
  expect(
    presentStrongDefinitions({ ...entry, definitionHtml: simple, detailedDefinitionHtml: detailed })
  ).toEqual({ essentialHtml: detailed })
})

it('retains complementary definitions, including new references', () => {
  expect(
    presentStrongDefinitions({
      ...entry,
      definitionHtml: 'serpent',
      detailedDefinitionHtml: '<a href="strong://H5175">serpent</a>',
    }).deep?.html
  ).toContain('href')
})

it('preserves independent simple-only and detailed-only resources', () => {
  expect(presentStrongDefinitions({ ...entry, detailedDefinitionHtml: undefined })).toEqual({
    essentialHtml: entry.definitionHtml,
  })
  expect(presentStrongDefinitions({ ...entry, definitionHtml: undefined })).toEqual({
    essentialHtml: entry.detailedDefinitionHtml,
  })
})

it('does not repeat identical text after HTML normalization', () => {
  expect(
    presentStrongDefinitions({
      ...entry,
      definitionHtml: '<b>abattage</b>',
      detailedDefinitionHtml: '<p>abattage</p>',
    })
  ).toEqual({ essentialHtml: '<b>abattage</b>' })
})

it('recognizes the expanded H7819b identity without relying on a display suffix', () => {
  expect(
    presentStrongDefinitions({ ...entry, eStrong: 'H7819b', detailedDefinitionHtml: specificSense })
  ).toEqual({
    essentialHtml: specificSense,
    deep: { kind: 'general', html: entry.definitionHtml },
  })
})

// Text and sibling relations from active publications read on 2026-09-29.
// These fixtures are test-only, never bundled into the app.

it.each(publishedExamples)(
  'presents published texts for $locale / $entry.stepCode',
  ({ locale, entry: published }) => {
    const presentation = presentStrongDefinitions({
      ...published,
      language: published.stepCode.startsWith('G') ? 'greek' : 'hebrew',
      relations: published.relations.map(relation => ({ ...relation, group: 'subentry' as const })),
    })
    const allTexts = [presentation.essentialHtml, presentation.deep?.html]
    if (['H5662H', 'H4601K'].includes(published.stepCode)) {
      // Named people: the specific person first, the historical family list in depth.
      expect(presentation).toEqual({
        essentialHtml: published.detailedDefinitionHtml,
        deep: { kind: 'general', html: published.definitionHtml },
      })
    } else if (locale === 'fr' && published.stepCode === 'H5175') {
      expect(presentation).toEqual({ essentialHtml: published.detailedDefinitionHtml })
    } else {
      // Includes H7819B, whose specific notice is only "abattage, mot douteux".
      expect(presentation.essentialHtml).toBe(published.definitionHtml)
      expect(allTexts).toContain(published.detailedDefinitionHtml)
    }
  }
)
