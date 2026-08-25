export const isStrongOriginalUnnamed = (original: string): boolean => {
  const normalizedOriginal = original.trim().toLowerCase()

  return normalizedOriginal === '' || normalizedOriginal === '[unnamed]'
}
