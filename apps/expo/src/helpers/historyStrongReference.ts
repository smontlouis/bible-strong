export type PersistedStrongHistoryIdentity = {
  reference?: string
  Code?: string | number
}

export const getHistoryStrongReference = ({
  reference,
  Code,
}: PersistedStrongHistoryIdentity): string | undefined =>
  reference ?? (Code == null ? undefined : String(Code))
