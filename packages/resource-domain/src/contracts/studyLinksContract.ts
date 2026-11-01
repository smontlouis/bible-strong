import * as Schema from 'effect/Schema'

export const StudyLinkKind = Schema.Literal('entity', 'nave', 'dictionary', 'timeline')
export type StudyLinkKind = typeof StudyLinkKind.Type

export const StudyLinkRole = Schema.Literal('subject', 'participant', 'mentioned')
export type StudyLinkRole = typeof StudyLinkRole.Type

export const StudyLinkLanguage = Schema.Literal('fr', 'en')
export type StudyLinkLanguage = typeof StudyLinkLanguage.Type

export class StudyLinksQuery extends Schema.Class<StudyLinksQuery>('StudyLinksQuery')({
  language: StudyLinkLanguage,
}) {}

export class StudyLinkDto extends Schema.Class<StudyLinkDto>('StudyLinkDto')({
  kind: StudyLinkKind,
  key: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  detail: Schema.optional(Schema.NonEmptyString),
  role: Schema.optional(StudyLinkRole),
}) {}

export class StudyLinksResponseDto extends Schema.Class<StudyLinksResponseDto>(
  'StudyLinksResponseDto'
)({
  kind: StudyLinkKind,
  key: Schema.NonEmptyString,
  language: StudyLinkLanguage,
  revision: Schema.NonEmptyString,
  links: Schema.Array(StudyLinkDto),
}) {}

export type StudyLinkRow = {
  kind: StudyLinkKind
  key: string
  label_fr: string
  label_en: string
  detail_fr: string | null
  detail_en: string | null
  language: string | null
  position: number | null
  role: string | null
}

export type StudyLinkView = {
  kind: StudyLinkKind
  key: string
  label: string
  detail?: string
  role?: StudyLinkRole
}

const byPosition = (left: StudyLinkRow, right: StudyLinkRow) =>
  left.position === null || right.position === null ? 0 : left.position - right.position

const KIND_ORDER: readonly StudyLinkKind[] = ['entity', 'nave', 'dictionary', 'timeline']

const isStudyLinkRole = (value: string | null): value is StudyLinkRole =>
  value === 'subject' || value === 'participant' || value === 'mentioned'

/**
 * What a reader sees from one subject, online and offline. A person only named by the description
 * of an event stays on the event: it is not one of that person's events. A dictionary article
 * shows in its own language only.
 */
export const readStudyLinks = (
  subjectKind: StudyLinkKind,
  language: StudyLinkLanguage,
  rows: readonly StudyLinkRow[]
): StudyLinkView[] =>
  [...rows]
    .filter(row => row.language === null || row.language === language)
    .filter(row => !(subjectKind === 'entity' && row.role === 'mentioned'))
    .sort(
      (left, right) =>
        KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
        byPosition(left, right) ||
        (language === 'fr' ? left.label_fr : left.label_en).localeCompare(
          language === 'fr' ? right.label_fr : right.label_en,
          language
        ) ||
        left.key.localeCompare(right.key)
    )
    .map(row => {
      const detail = language === 'fr' ? row.detail_fr : row.detail_en
      return {
        kind: row.kind,
        key: row.key,
        label: language === 'fr' ? row.label_fr : row.label_en,
        ...(detail ? { detail } : {}),
        ...(isStudyLinkRole(row.role) ? { role: row.role } : {}),
      }
    })
