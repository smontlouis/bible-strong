export const OFFLINE_SETUP_BIBLE_FACT_KEYS = [
  'offlineSetup.bibleFacts.methuselah',
  'offlineSetup.bibleFacts.talkingDonkey',
  'offlineSetup.bibleFacts.ehud',
  'offlineSetup.bibleFacts.elijah',
  'offlineSetup.bibleFacts.floatingIron',
  'offlineSetup.bibleFacts.eutychus',
  'offlineSetup.bibleFacts.sunStoodStill',
  'offlineSetup.bibleFacts.psalm119',
  'offlineSetup.bibleFacts.gideon',
  'offlineSetup.bibleFacts.fishCoin',
] as const

export const getNextBibleFactIndex = (currentIndex: number): number =>
  (currentIndex + 1) % OFFLINE_SETUP_BIBLE_FACT_KEYS.length
