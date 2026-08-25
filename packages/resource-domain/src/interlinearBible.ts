export type ResourceLanguage = 'fr' | 'en'

export type InterlinearIdentityKind = 'strong' | 'estrong' | 'dstrong' | 'ustrong'

export interface InterlinearSegment {
  ordinal: number
  startOffset: number
  length: number
  transliteration: string
  lemma: string
  morphology: string
  gloss: string
  identities: { kind: InterlinearIdentityKind; code: string }[]
}

export interface InterlinearToken {
  id?: number
  ordinal: number
  startOffset: number
  length: number
  segments: InterlinearSegment[]
}

export type InterlinearChapterTokens = Record<number, InterlinearToken[]>
