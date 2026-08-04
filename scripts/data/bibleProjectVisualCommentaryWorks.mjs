const passage = (
  book,
  chapterStart,
  verseStart,
  chapterEnd,
  verseEnd,
  placement = 'after-range',
  evidenceUrl
) => ({
  kind: 'passage',
  book,
  chapterStart,
  ...(verseStart ? { verseStart } : {}),
  ...(chapterEnd ? { chapterEnd } : {}),
  ...(verseEnd ? { verseEnd } : {}),
  placement,
  ...(evidenceUrl ? { evidenceUrl } : {}),
})

const RELIGIOUS_PRACTICES_SCRIPT =
  'https://d1bsmz3sdihplr.cloudfront.net/media/SOTM-Episode-6/Premiere%20Video/SOTM06_Script%20References.pdf'

export const BIBLE_PROJECT_VISUAL_COMMENTARY_WORKS = [
  {
    id: 'sermon-on-mount-series-intro',
    sourceUrl: 'https://bibleproject.com/videos/intro-to-sermon-on-the-mount/',
    anchors: [passage(40, 5, 1, 7, 29, 'before-range')],
    editions: { en: 'NtKb7CJDUZc', fr: 'ZIrt850LLIo' },
  },
  {
    id: 'sermon-on-mount-series-beatitudes',
    sourceUrl: 'https://bibleproject.com/videos/the-beatitudes/',
    anchors: [passage(40, 5, 3, 5, 16)],
    editions: { en: 's9246LGlngs', fr: 'R4mDSe8tGuI' },
  },
  {
    id: 'sermon-on-mount-series-jesus-fulfills-law',
    sourceUrl: 'https://bibleproject.com/videos/jesus-fulfills-the-law/',
    anchors: [passage(40, 5, 17, 5, 20)],
    editions: { en: 'KUil1m3P2iI', fr: 'ncszdDRy0-s' },
  },
  {
    id: 'sermon-on-mount-series-murder-adultery-divorce',
    sourceUrl: 'https://bibleproject.com/videos/wisdom-underneath-laws/',
    anchors: [passage(40, 5, 21, 5, 32)],
    editions: { en: 'okFibMvn3t0', fr: 'XgL1itLMbZI' },
  },
  {
    id: 'sermon-on-mount-series-oaths-retaliation-enemy-love',
    sourceUrl:
      'https://bibleproject.com/videos/wisdom-within-laws-about-oaths-retaliation-and-enemy-love/',
    anchors: [passage(40, 5, 33, 5, 48)],
    editions: { en: '3EkD-alQhT8', fr: 'AgnvQ-HGKwc' },
  },
  {
    id: 'sermon-on-mount-series-religious-practices',
    sourceUrl: 'https://bibleproject.com/videos/warnings-about-religious-practices/',
    anchors: [
      passage(40, 6, 1, 6, 6, 'after-range', RELIGIOUS_PRACTICES_SCRIPT),
      passage(40, 6, 16, 6, 18, 'after-range', RELIGIOUS_PRACTICES_SCRIPT),
    ],
    editions: { en: 'wCo2LN7E6bo', fr: 'At-rlvIFjHg' },
  },
  {
    id: 'sermon-on-mount-series-lords-prayer',
    sourceUrl: 'https://bibleproject.com/videos/lords-prayer/',
    anchors: [passage(40, 6, 9, 6, 13)],
    editions: { en: '3-YlqQfKkKk', fr: 'Ws74bmmpf8w' },
  },
  {
    id: 'sermon-on-mount-series-wealth-worry',
    sourceUrl: 'https://bibleproject.com/videos/wealth-and-worry/',
    anchors: [passage(40, 6, 19, 6, 34)],
    editions: { en: 'GpqOdHV3dmU', fr: 'mBJrqtG_Cdk' },
  },
  {
    id: 'sermon-on-mount-series-wisdom-relationships',
    sourceUrl: 'https://bibleproject.com/videos/wisdom-in-relationships/',
    anchors: [passage(40, 7, 1, 7, 12)],
    editions: { en: 'PqEiqCuIsvw', fr: 'txV5-inh6GM' },
  },
  {
    id: 'sermon-on-mount-series-choice',
    sourceUrl: 'https://bibleproject.com/videos/the-choice/',
    anchors: [passage(40, 7, 13, 7, 27)],
    editions: { en: '0iJ1-_nH47c', fr: 'Ofmvixu-FIY' },
  },
  {
    id: 'sermon-on-mount-visual-overview',
    sourceUrl: 'https://bibleproject.com/videos/matthew-5-7-sermon-overview/',
    anchors: [passage(40, 5, 1, 7, 29, 'before-range')],
    editions: { en: 'ajwehw_AT0s', fr: 'lD91ISyYLns' },
  },
  {
    id: 'sermon-on-mount-visual-beatitudes',
    sourceUrl: 'https://bibleproject.com/videos/matthew-5-3-16-beatitudes/',
    anchors: [passage(40, 5, 3, 5, 16)],
    editions: { en: 'W9fR7sHw9Y8', fr: 'fAtTege_8Uw' },
  },
  {
    id: 'sermon-on-mount-visual-righteousness',
    sourceUrl: 'https://bibleproject.com/videos/matthew-5-17-20-righteousness-and-jesus-bible/',
    anchors: [passage(40, 5, 17, 5, 20)],
    editions: { en: 'Bpk-sI4MY58', fr: 'hzheDBua6Ds' },
  },
  {
    id: 'sermon-on-mount-visual-generosity',
    sourceUrl: 'https://bibleproject.com/videos/matthew-6-1-4-generosity-and-true-reward/',
    anchors: [passage(40, 6, 1, 6, 4)],
    editions: { fr: '5xpP3ehZQ_Q' },
  },
  {
    id: 'sermon-on-mount-visual-lords-prayer',
    sourceUrl: 'https://bibleproject.com/videos/matthew-6-9-13-prayer-jesus/',
    anchors: [passage(40, 6, 9, 6, 13)],
    editions: { fr: '0hmvIRKOmWI' },
  },
  {
    id: 'sermon-on-mount-visual-wealth',
    sourceUrl: 'https://bibleproject.com/videos/matthew-619-23-true-wealth-and-generosity/',
    anchors: [passage(40, 6, 19, 6, 23)],
    editions: { fr: 'JVCL1zZrEgU' },
  },
  {
    id: 'genesis-1-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/genesis-1/',
    anchors: [passage(1, 1, 1, 1, 31)],
    editions: { en: 'afVN-7vY0KA', fr: '-V8X5SJKIKY' },
  },
  {
    id: 'exodus-34-6-7-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/character-of-god-exodus/',
    anchors: [passage(2, 34, 6, 34, 7)],
    editions: { en: 'nxwzq1PJImM' },
  },
  {
    id: 'psalm-1-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/psalm-1/',
    anchors: [passage(19, 1, 1, 1, 6)],
    editions: { en: 'E7k01kfBx6Y', fr: 'dFLNnAF0Kno' },
  },
  {
    id: 'psalm-8-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/psalm-8/',
    anchors: [passage(19, 8, 1, 8, 9)],
    editions: { en: 'd_-xvaK4wIw' },
  },
  {
    id: 'psalm-148-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/psalm-148/',
    anchors: [passage(19, 148, 1, 148, 14)],
    editions: { en: 'XgCrFl4Mc5Q', fr: 'sEVljAVAjQE' },
  },
  {
    id: 'proverbs-8-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/proverbs-8/',
    anchors: [passage(20, 8, 1, 8, 36)],
    editions: { en: 'k8P-x34iYRE', fr: 'z37vJGdYEZw' },
  },
  {
    id: 'isaiah-61-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/isaiah-61/',
    anchors: [passage(23, 61, 1, 61, 11)],
    editions: { en: 'd_Q6WkD_Pas', fr: 'wvqT2nT7YQs' },
  },
  {
    id: 'john-1-visual-commentary',
    sourceUrl: 'https://bibleproject.com/videos/john-1/',
    anchors: [passage(43, 1, 1, 1, 18)],
    editions: { en: 'XgslCbXOOIE', fr: 'Ag43Hsy7I9g' },
  },
]

export const BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS = [
  {
    providerId: 'yIVUi1xSaMw',
    language: 'fr',
    reason: 'trailer-not-editorial-commentary',
    evidenceUrl: 'https://www.youtube.com/watch?v=yIVUi1xSaMw',
  },
]
