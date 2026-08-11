import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import { getNextBibleFactIndex, OFFLINE_SETUP_BIBLE_FACT_KEYS } from '../offlineSetupBibleFacts'
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

  it('cycles through ten Bible facts', () => {
    expect(OFFLINE_SETUP_BIBLE_FACT_KEYS).toHaveLength(10)
    expect(getNextBibleFactIndex(0)).toBe(1)
    expect(getNextBibleFactIndex(OFFLINE_SETUP_BIBLE_FACT_KEYS.length - 1)).toBe(0)
  })
})
