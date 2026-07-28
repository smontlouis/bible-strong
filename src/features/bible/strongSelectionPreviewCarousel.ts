export const getStrongSelectionPreviewIndex = (
  offsetX: number,
  carouselStep: number,
  previewCount: number
) => {
  if (carouselStep <= 0 || previewCount <= 0) return 0
  return Math.max(0, Math.min(Math.round(offsetX / carouselStep), previewCount - 1))
}
