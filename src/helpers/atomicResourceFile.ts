import * as FileSystem from 'expo-file-system/legacy'

export const restoreOrphanedResourceBackup = async (
  destinationPath: string,
  backupPath: string
): Promise<void> => {
  const [destination, backup] = await Promise.all([
    FileSystem.getInfoAsync(destinationPath),
    FileSystem.getInfoAsync(backupPath),
  ])
  if (!destination.exists && backup.exists) {
    await FileSystem.moveAsync({ from: backupPath, to: destinationPath })
  }
}
