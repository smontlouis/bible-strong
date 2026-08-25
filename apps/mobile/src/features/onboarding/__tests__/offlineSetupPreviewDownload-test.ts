import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import { getRandomBibleFactIndex, OFFLINE_SETUP_BIBLE_FACT_KEYS } from '../offlineSetupBibleFacts'
import { getPreviewDownloadProgress } from '../offlineSetupPreviewDownload'

describe('offline setup preview download', () => {
  it('spreads preview progress over fifteen seconds', () => {
    expect(OFFLINE_SETUP_MOTION.download.preview.duration).toBe(15_000)
    expect(getPreviewDownloadProgress(0)).toBe(0)
    expect(getPreviewDownloadProgress(7_500)).toBe(0.5)
    expect(getPreviewDownloadProgress(15_000)).toBe(1)
  })

  it('clamps elapsed time outside the preview duration', () => {
    expect(getPreviewDownloadProgress(-1_000)).toBe(0)
    expect(getPreviewDownloadProgress(30_000)).toBe(1)
  })

  it('randomly selects among the Bible facts without repeating the current one', () => {
    expect(OFFLINE_SETUP_BIBLE_FACT_KEYS).toHaveLength(13)
    expect(getRandomBibleFactIndex(undefined, () => 0)).toBe(0)
    expect(getRandomBibleFactIndex(undefined, () => 0.999)).toBe(12)
    expect(getRandomBibleFactIndex(0, () => 0)).toBe(1)
    expect(getRandomBibleFactIndex(6, () => 0.5)).not.toBe(6)
  })
})
