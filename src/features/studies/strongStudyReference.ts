export type PersistedStudyStrongReference = {
  codeStrong?: string | number | null
  code?: string | number | null
}

export const getPersistedStudyStrongReference = ({
  codeStrong,
  code,
}: PersistedStudyStrongReference): string | undefined => {
  const value = codeStrong ?? code
  if (value == null) return undefined
  const reference = String(value).trim()
  return reference || undefined
}
