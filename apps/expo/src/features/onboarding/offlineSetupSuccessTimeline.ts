import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'

export type OfflineSetupSuccessTimeline = {
  readyEndsAt: number
  welcomeStartsAt: number
  fadeOutStartsAt: number
  completesAt: number
}

export const getOfflineSetupSuccessTimeline = (
  reduceMotion: boolean
): OfflineSetupSuccessTimeline => {
  const successMotion = OFFLINE_SETUP_MOTION.download.success
  const readyDuration = reduceMotion
    ? successMotion.reducedMotionReadyDuration
    : successMotion.readyDuration
  const messageGap = reduceMotion ? 0 : successMotion.messageGap
  const fadeOutDuration = reduceMotion ? 0 : successMotion.fadeOutDuration
  const welcomeStartsAt = readyDuration + messageGap
  const fadeOutStartsAt = welcomeStartsAt + successMotion.welcomeHoldDuration

  return {
    readyEndsAt: readyDuration,
    welcomeStartsAt,
    fadeOutStartsAt,
    completesAt: fadeOutStartsAt + fadeOutDuration,
  }
}
