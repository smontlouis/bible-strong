import { areStrongIdentitiesEqual, type StrongIdentity } from '~helpers/strongIdentities'

export const getStrongSelectionPreviewIndex = (
  offsetX: number,
  carouselStep: number,
  previewCount: number
) => {
  if (carouselStep <= 0 || previewCount <= 0) return 0
  return Math.max(0, Math.min(Math.round(offsetX / carouselStep), previewCount - 1))
}

export const prioritizeStrongSelectionPreview = <
  Preview extends { selectedIdentity: StrongIdentity },
>(
  previews: Preview[],
  selectedIdentity?: StrongIdentity
): Preview[] => {
  if (!selectedIdentity) return previews
  const selectedIndex = previews.findIndex(preview =>
    areStrongIdentitiesEqual(preview.selectedIdentity, selectedIdentity)
  )
  if (selectedIndex <= 0) return previews
  return [previews[selectedIndex], ...previews.filter((_, index) => index !== selectedIndex)]
}
