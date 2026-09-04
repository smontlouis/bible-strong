export const OFFLINE_SETUP_BIBLE_FACT_KEYS = [
  'offlineSetup.bibleFacts.jehovah',
  'offlineSetup.bibleFacts.johnLove',
  'offlineSetup.bibleFacts.lucifer',
  'offlineSetup.bibleFacts.christTitle',
  'offlineSetup.bibleFacts.jesusJoshua',
  'offlineSetup.bibleFacts.hosanna',
  'offlineSetup.bibleFacts.sheol',
  'offlineSetup.bibleFacts.gehenna',
  'offlineSetup.bibleFacts.adamAdamah',
  'offlineSetup.bibleFacts.adamSide',
  'offlineSetup.bibleFacts.shalom',
  'offlineSetup.bibleFacts.strongNumbers',
  'offlineSetup.bibleFacts.psalm119',
] as const

export const getRandomBibleFactIndex = (
  currentIndex?: number,
  random: () => number = Math.random
): number => {
  const factCount = OFFLINE_SETUP_BIBLE_FACT_KEYS.length

  if (currentIndex === undefined || factCount < 2) {
    return Math.floor(random() * factCount)
  }

  const randomIndexWithoutCurrent = Math.floor(random() * (factCount - 1))
  return randomIndexWithoutCurrent >= currentIndex
    ? randomIndexWithoutCurrent + 1
    : randomIndexWithoutCurrent
}
