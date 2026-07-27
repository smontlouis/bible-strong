export type StrongBibleIdentityKind = 'strong' | 'estrong' | 'dstrong' | 'ustrong'

export interface StrongBibleSpan {
  ordinal: number
  startOffset: number
  length: number
  stepTokenIds?: number[]
  identities: {
    kind: StrongBibleIdentityKind
    code: string
  }[]
}

export const buildStrongAnnotatedText = (
  canonicalText: string,
  spans: StrongBibleSpan[]
): string => {
  const insertions = spans.flatMap(span => {
    if (span.length <= 0 || span.startOffset + span.length > canonicalText.length) return []
    const references = span.identities
      .filter(identity => identity.kind === 'strong')
      .map(identity => identity.code.match(/\d+/u)?.[0])
      .filter((reference): reference is string => Boolean(reference))
    if (references.length === 0) return []
    return [
      {
        offset: span.startOffset + span.length,
        ordinal: span.ordinal,
        text: ` ${[...new Set(references)].join(' ')}`,
      },
    ]
  })

  return insertions
    .sort((left, right) => right.offset - left.offset || right.ordinal - left.ordinal)
    .reduce(
      (text, insertion) =>
        `${text.slice(0, insertion.offset)}${insertion.text}${text.slice(insertion.offset)}`,
      canonicalText
    )
}
