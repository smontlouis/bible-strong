import type { StrongLexiconPreview } from '~features/resources/strongLexiconAccess'

type StrongSelectionPreviewCardSource = Pick<
  StrongLexiconPreview,
  'gloss' | 'original' | 'stepCode' | 'transliteration'
>

export const createStrongSelectionPreviewCard = (
  preview: StrongSelectionPreviewCardSource,
  morphologyCodes: readonly string[]
) => ({
  gloss: preview.gloss,
  original: preview.original,
  transliteration: preview.transliteration,
  morphology: morphologyCodes.length ? morphologyCodes.join(' · ') : undefined,
})
