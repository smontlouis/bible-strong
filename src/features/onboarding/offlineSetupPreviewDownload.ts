import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'

export const getPreviewDownloadProgress = (elapsedMilliseconds: number): number => {
  const progress = elapsedMilliseconds / OFFLINE_SETUP_MOTION.download.preview.duration
  return Math.min(1, Math.max(0, progress))
}
