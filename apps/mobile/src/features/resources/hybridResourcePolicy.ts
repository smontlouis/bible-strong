export type HybridResourceSource = 'local' | 'remote' | 'offline' | 'unsupported'

export const resolveHybridResourceSource = async ({
  localAvailable,
  remotelyReadable,
  isOnline,
}: {
  localAvailable: boolean
  remotelyReadable: boolean
  isOnline: () => Promise<boolean>
}): Promise<HybridResourceSource> => {
  if (localAvailable) return 'local'
  if (!remotelyReadable) return 'unsupported'
  return (await isOnline()) ? 'remote' : 'offline'
}
