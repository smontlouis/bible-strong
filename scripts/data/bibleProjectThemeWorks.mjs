const passage = (book, chapterStart, verseStart, chapterEnd, verseEnd, relevance = 'primary') => ({
  kind: 'passage',
  book,
  chapterStart,
  ...(verseStart ? { verseStart } : {}),
  ...(chapterEnd ? { chapterEnd } : {}),
  ...(verseEnd ? { verseEnd } : {}),
  relevance,
})

const related = (book, chapterStart, verseStart, chapterEnd, verseEnd) =>
  passage(book, chapterStart, verseStart, chapterEnd, verseEnd, 'related')

const EDITORIAL_ENTRY_POINT_WORK_IDS = new Set([
  'bp-theme-royal-priest-david',
  'bp-theme-royal-priest-jesus',
  'bp-theme-royal-priesthood',
  'bp-theme-spiritual-beings-god',
  'bp-theme-spiritual-beings-introduction',
  'bp-theme-spiritual-beings-angels-cherubim',
  'bp-theme-spiritual-beings-angel-of-yhwh',
  'bp-theme-spiritual-beings-satan-demons',
  'bp-theme-spiritual-beings-new-humanity',
  'bp-theme-way-of-the-exile',
  'bp-theme-covenants',
  'bp-theme-redemption',
  'bp-theme-holiness',
  'bp-theme-heaven-and-earth',
  'bp-theme-public-reading-scripture',
  'bp-theme-city',
  'bp-theme-exile',
  'bp-theme-exodus-way',
  'bp-theme-justice',
  'bp-theme-wilderness',
  'bp-theme-day-of-the-lord',
  'bp-theme-tree-of-life',
  'bp-theme-last-will-be-first',
  'bp-theme-mountain',
  'bp-theme-anointing',
  'bp-theme-holy-spirit',
  'bp-theme-water-of-life',
  'bp-theme-generosity',
])

const work = (id, series, sourceUrl, editions, primaryAnchor, relatedAnchors = []) => ({
  id,
  series,
  sourceUrl,
  editions,
  anchors: [primaryAnchor, ...relatedAnchors].map(anchor => ({
    ...anchor,
    provenance: EDITORIAL_ENTRY_POINT_WORK_IDS.has(id) ? 'editorial-review' : 'publisher-passage',
  })),
})

const TEN_COMMANDMENTS = 'https://bibleproject.com/videos/collections/the-10-commandments/'
const ROYAL_PRIEST = 'https://bibleproject.com/videos/collections/the-royal-priest/'
const SPIRITUAL_BEINGS = 'https://bibleproject.com/videos/collections/spiritual-beings/'

export const BIBLE_PROJECT_THEME_WORKS = [
  work(
    'bp-theme-ten-commandments-wisdom',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: '4M9BsOvx6cs', fr: '5lTa7w35MyE' },
    passage(2, 20, 1, 20, 17),
    [related(5, 5, 6, 5, 21), related(19, 1, 1, 1, 6)]
  ),
  work(
    'bp-theme-ten-commandments-01-no-other-gods',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'JGI8nNVkZpA', fr: 'YZWuWGDIRjw' },
    passage(2, 20, 3, 20, 3),
    [related(5, 5, 7, 5, 7)]
  ),
  work(
    'bp-theme-ten-commandments-02-no-idols',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'vXHDUs28rPM', fr: '-AnYtcOxw4s' },
    passage(2, 20, 4, 20, 6),
    [related(5, 5, 8, 5, 10)]
  ),
  work(
    'bp-theme-ten-commandments-03-carry-the-name',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'elhazm4fZeE', fr: 'uqDDycCxItU' },
    passage(2, 20, 7, 20, 7),
    [related(5, 5, 11, 5, 11)]
  ),
  work(
    'bp-theme-ten-commandments-04-sabbath',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'VsAmFJ6quZk', fr: 'tebmrRnqFMg' },
    passage(2, 20, 8, 20, 11),
    [related(5, 5, 12, 5, 15)]
  ),
  work(
    'bp-theme-ten-commandments-05-honor-parents',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'Q7PgVAN2MPo', fr: 'kvcJ_tHPc8I' },
    passage(2, 20, 12, 20, 12),
    [related(5, 5, 16, 5, 16)]
  ),
  work(
    'bp-theme-ten-commandments-06-protect-life',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'uAQ5KaEd98Q', fr: 'LV0-KIsZsBc' },
    passage(2, 20, 13, 20, 13),
    [related(5, 5, 17, 5, 17)]
  ),
  work(
    'bp-theme-ten-commandments-07-protect-marriage',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'Pyk64lwOLpw', fr: 'UwxUrEnl9Bk' },
    passage(2, 20, 14, 20, 14),
    [related(5, 5, 18, 5, 18)]
  ),
  work(
    'bp-theme-ten-commandments-08-do-not-steal',
    'ten-commandments',
    TEN_COMMANDMENTS,
    { en: 'WylKQKFI_4M', fr: 'LBICDuRlPmo' },
    passage(2, 20, 15, 20, 15),
    [related(5, 5, 19, 5, 19)]
  ),
  work(
    'bp-theme-ten-commandments-09-truthful-witness',
    'ten-commandments',
    'https://www.youtube.com/watch?v=SSBRI49NYmY',
    { en: 'SSBRI49NYmY' },
    passage(2, 20, 16, 20, 16),
    [related(5, 5, 20, 5, 20)]
  ),
  work(
    'bp-theme-ten-commandments-10-desire',
    'ten-commandments',
    'https://www.youtube.com/watch?v=185KpeCc-CY',
    { en: '185KpeCc-CY' },
    passage(2, 20, 17, 20, 17),
    [related(5, 5, 21, 5, 21)]
  ),
  work(
    'bp-theme-royal-priest-eden',
    'royal-priest',
    'https://bibleproject.com/videos/priests-of-eden/',
    { en: 'K60TAYja110', fr: 'oSP0VMl-yCg' },
    passage(1, 1, 26, 1, 28),
    [related(1, 2, 15, 2, 15), related(4, 4, 16, 4, 16)]
  ),
  work(
    'bp-theme-royal-priest-melchizedek',
    'royal-priest',
    'https://bibleproject.com/videos/abraham-and-melchizedek/',
    { en: 'KlZjA-3hiys', fr: 'GpyKgtgnJmc' },
    passage(1, 14, 17, 14, 20),
    [related(19, 110, 4, 110, 4), related(58, 7, 1, 7, 28)]
  ),
  work(
    'bp-theme-royal-priest-moses-aaron',
    'royal-priest',
    'https://bibleproject.com/videos/moses-and-aaron/',
    { en: 'rhc1SjvYXqE', fr: 'BWN1IDgN0sI' },
    passage(2, 19, 3, 19, 6),
    [related(2, 32, 1, 32, 5), related(2, 32, 30, 32, 32)]
  ),
  work(
    'bp-theme-royal-priest-david',
    'royal-priest',
    ROYAL_PRIEST,
    { en: 'JCP2zWaJlGc', fr: 'h1tBSe_0eCA' },
    passage(10, 6, 13, 6, 17),
    [related(19, 110, 1, 110, 7), related(13, 21, 26, 22, 1)]
  ),
  work(
    'bp-theme-royal-priest-jesus',
    'royal-priest',
    ROYAL_PRIEST,
    { en: 'LBr-blQxIm4', fr: 'ZJL2ZVDiJL8' },
    passage(41, 10, 45, 10, 45),
    [related(58, 7, 1, 10, 39)]
  ),
  work(
    'bp-theme-royal-priesthood',
    'royal-priest',
    ROYAL_PRIEST,
    { en: 'Tw-bBfBDpE0', fr: 'QURmKkdxTk4' },
    passage(60, 2, 4, 2, 9),
    [related(66, 22, 3, 22, 5)]
  ),
  work(
    'bp-theme-spiritual-beings-god',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'eAvYmE2YYIU', fr: 'tPxYu0ZPsjs' },
    passage(1, 1, 1, 1, 3),
    [related(43, 1, 1, 1, 3)]
  ),
  work(
    'bp-theme-spiritual-beings-introduction',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'cBxOZqtGTXE', fr: '9spMKqeT8zU' },
    passage(1, 1, 1, 1, 1),
    [related(19, 148, 1, 148, 14)]
  ),
  work(
    'bp-theme-spiritual-beings-elohim',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'U5iyUik97Lg', fr: '9QezT4U-vrU' },
    passage(19, 82, 1, 82, 1),
    [related(5, 6, 4, 6, 4)]
  ),
  work(
    'bp-theme-spiritual-beings-divine-council',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'e1rai6WoOJU', fr: 'uRHqnheTYzQ' },
    passage(19, 82, 1, 82, 8),
    [related(5, 32, 8, 32, 9)]
  ),
  work(
    'bp-theme-spiritual-beings-angels-cherubim',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: '-bMRxQbLUlg', fr: '2BgWsZx7-5E' },
    passage(1, 3, 24, 3, 24),
    [related(2, 25, 18, 25, 22), related(23, 6, 1, 6, 7)]
  ),
  work(
    'bp-theme-spiritual-beings-angel-of-yhwh',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'qgmf8bHayXw', fr: 'Gth9P04n3o8' },
    passage(2, 3, 1, 3, 6),
    [related(1, 16, 7, 16, 13)]
  ),
  work(
    'bp-theme-spiritual-beings-satan-demons',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'CamYtVpoTNk', fr: 'xbskH8vOe4k' },
    passage(1, 3, 1, 3, 15),
    [related(18, 1, 6, 1, 12)]
  ),
  work(
    'bp-theme-spiritual-beings-new-humanity',
    'spiritual-beings',
    SPIRITUAL_BEINGS,
    { en: 'takEeHtRrMw', fr: '068pfnkfPOQ' },
    passage(27, 7, 13, 7, 14),
    [related(1, 1, 26, 1, 28)]
  ),
  work(
    'bp-theme-way-of-the-exile',
    'biblical-themes',
    'https://bibleproject.com/videos/way-of-the-exile/',
    { en: 'XzWpa0gcPyo', fr: 'eN7pv0trosE' },
    passage(24, 29, 4, 29, 7),
    [related(27, 1, 8, 1, 16)]
  ),
  work(
    'bp-theme-covenants',
    'biblical-themes',
    'https://bibleproject.com/videos/covenants/',
    { en: '6v4jKkFj3TI', fr: 'MfuYg7P0iBI' },
    passage(1, 12, 1, 12, 3),
    [
      related(1, 9, 8, 9, 17),
      related(2, 19, 3, 19, 6),
      related(10, 7, 12, 7, 16),
      related(24, 31, 31, 31, 34),
    ]
  ),
  work(
    'bp-theme-chaos-dragon',
    'biblical-themes',
    'https://bibleproject.com/guides/dragons-in-the-bible/',
    { en: 'JN1thcowKXw', fr: 'h-Pf4M6VZrU' },
    passage(1, 1, 20, 1, 21),
    [related(19, 74, 12, 74, 17), related(23, 27, 1, 27, 1), related(66, 12, 1, 12, 17)]
  ),
  work(
    'bp-theme-passover',
    'biblical-themes',
    'https://www.youtube.com/watch?v=14x_PtlnJHw',
    { en: '14x_PtlnJHw', fr: 'RRna_gY_TLE' },
    passage(2, 12, 1, 12, 28),
    [related(23, 31, 5, 31, 5)]
  ),
  work(
    'bp-theme-gospel-of-the-kingdom',
    'biblical-themes',
    'https://bibleproject.com/videos/gospel-kingdom/',
    { en: 'xmFPS0f-kzs', fr: 'txGfRrR9v_M' },
    passage(41, 1, 14, 1, 15),
    [related(23, 52, 7, 52, 7)]
  ),
  work(
    'bp-theme-redemption',
    'biblical-themes',
    'https://www.youtube.com/watch?v=uib2G8GkG60',
    { en: 'uib2G8GkG60', fr: 'lX7rZ7hp_gQ' },
    passage(2, 12, 1, 12, 13),
    [related(60, 1, 18, 1, 19)]
  ),
  work(
    'bp-theme-holiness',
    'biblical-themes',
    'https://bibleproject.com/videos/holiness/',
    { en: 'l9vn5UvsHvM', fr: 'jxKoDvf2nXk' },
    passage(3, 11, 44, 11, 45),
    [related(23, 6, 1, 6, 7)]
  ),
  work(
    'bp-theme-heaven-and-earth',
    'biblical-themes',
    'https://bibleproject.com/videos/heaven-and-earth/',
    { en: 'Zy2AQlK6C5k', fr: 'PZ-CmV2Xg6A' },
    passage(1, 1, 1, 1, 1),
    [related(66, 21, 1, 21, 5)]
  ),
  work(
    'bp-theme-public-reading-scripture',
    'biblical-themes',
    'https://bibleproject.com/videos/public-reading-scripture/',
    { en: 'BO1Y9XyWKTw', fr: 'OMPI6mMPj7E' },
    passage(16, 8, 1, 8, 8),
    [related(54, 4, 13, 4, 13)]
  ),
  work(
    'bp-theme-sabbath',
    'biblical-themes',
    'https://bibleproject.com/videos/sabbath-video/',
    { en: 'PFTLvkB3JLM', fr: '6lowTdQ61Y4' },
    passage(1, 1, 1, 2, 3),
    [related(2, 20, 8, 20, 11), related(3, 25, 1, 25, 55), related(42, 4, 14, 4, 21)]
  ),
  work(
    'bp-theme-city',
    'biblical-themes',
    'https://bibleproject.com/videos/city/',
    { en: '5yZLFmVHfaw', fr: 'zv1LAco6pTk' },
    passage(1, 4, 17, 4, 17),
    [related(1, 11, 1, 11, 9), related(66, 21, 1, 21, 27)]
  ),
  work(
    'bp-theme-exile',
    'biblical-themes',
    'https://bibleproject.com/videos/exile/',
    { en: 'xSua9_WhQFE', fr: 'nFHZQT0GuBI' },
    passage(1, 3, 22, 3, 24),
    [related(12, 25, 1, 25, 21)]
  ),
  work(
    'bp-theme-image-of-god',
    'biblical-themes',
    'https://bibleproject.com/videos/image-of-god/',
    { en: 'YbipxLDtY8c', fr: 'sDnohPQxLD8' },
    passage(1, 1, 26, 1, 28),
    [related(51, 1, 15, 1, 20)]
  ),
  work(
    'bp-theme-exodus-way',
    'biblical-themes',
    'https://www.youtube.com/watch?v=dYPlBq8ELvA',
    { en: 'dYPlBq8ELvA', fr: 'pekXBuUDiyE' },
    passage(2, 14, 10, 14, 31),
    [related(42, 9, 28, 9, 36), related(44, 9, 1, 9, 2)]
  ),
  work(
    'bp-theme-sacrifice-atonement',
    'biblical-themes',
    'https://bibleproject.com/videos/sacrifice-and-atonement/',
    { en: 'G_OlRWGLdnw', fr: 'wmICj1t6UIA' },
    passage(3, 16, 1, 16, 34),
    [related(58, 9, 6, 9, 14), related(40, 26, 26, 26, 28)]
  ),
  work(
    'bp-theme-justice',
    'biblical-themes',
    'https://bibleproject.com/videos/justice/',
    { en: 'A14THPoc4-4', fr: 'H3-GGFM3WqM' },
    passage(33, 6, 8, 6, 8),
    [related(20, 31, 8, 31, 9), related(42, 4, 16, 4, 21)]
  ),
  work(
    'bp-theme-wilderness',
    'biblical-themes',
    'https://www.youtube.com/watch?v=b54d_GhBthI',
    { en: 'b54d_GhBthI', fr: 'rRN01oNzNo8' },
    passage(2, 16, 1, 16, 36),
    [related(40, 4, 1, 4, 11)]
  ),
  work(
    'bp-theme-blessing-and-curse',
    'biblical-themes',
    'https://bibleproject.com/videos/blessing-and-curse/',
    { en: 'jQaeIJOA6J0', fr: 'Wm30OGylv4Q' },
    passage(1, 12, 1, 12, 3),
    [related(1, 3, 14, 3, 19), related(48, 3, 13, 3, 14)]
  ),
  work(
    'bp-theme-day-of-the-lord',
    'biblical-themes',
    'https://bibleproject.com/videos/day-of-the-lord/',
    { en: 'tEBc2gSSW04', fr: 'utHEZsmzU74' },
    passage(29, 2, 1, 2, 2),
    [related(52, 5, 1, 5, 11)]
  ),
  work(
    'bp-theme-law',
    'biblical-themes',
    'https://bibleproject.com/videos/law/',
    { en: '3BGO9Mmd_cU', fr: 'IDS6LONO8Sw' },
    passage(2, 20, 1, 20, 17),
    [related(40, 22, 34, 22, 40)]
  ),
  work(
    'bp-theme-temple',
    'biblical-themes',
    'https://bibleproject.com/videos/temple/',
    { en: 'wTnq6I3vUbU', fr: 'ZjoRCeqpUSA' },
    passage(1, 1, 1, 2, 3),
    [related(11, 6, 1, 6, 38), related(44, 2, 1, 2, 4), related(49, 2, 19, 2, 22)]
  ),
  work(
    'bp-theme-tree-of-life',
    'biblical-themes',
    'https://bibleproject.com/videos/tree-of-life/',
    { en: 'TJLan-pJzfQ', fr: 'FRqpC4yLc68' },
    passage(1, 2, 8, 2, 9),
    [related(66, 22, 1, 22, 5)]
  ),
  work(
    'bp-theme-eternal-life',
    'biblical-themes',
    'https://bibleproject.com/videos/eternal-life/',
    { en: 'uCOycIMyJZM', fr: 'u-2dqyddp2o' },
    passage(43, 17, 3, 17, 3),
    [related(43, 3, 16, 3, 16)]
  ),
  work(
    'bp-theme-last-will-be-first',
    'biblical-themes',
    'https://www.youtube.com/watch?v=n-UenIDevpI',
    { en: 'n-UenIDevpI', fr: 'A-eeOo_TgYk' },
    passage(41, 10, 31, 10, 45),
    [related(51, 1, 15, 1, 20)]
  ),
  work(
    'bp-theme-mountain',
    'biblical-themes',
    'https://www.youtube.com/watch?v=CxDIeoVz7_8',
    { en: 'CxDIeoVz7_8', fr: 'bfQ6I4Smh7A' },
    passage(2, 19, 1, 19, 6),
    [related(1, 2, 8, 2, 14), related(40, 17, 1, 17, 8)]
  ),
  work(
    'bp-theme-anointing',
    'biblical-themes',
    'https://www.youtube.com/watch?v=-uPNMO-YA5E',
    { en: '-uPNMO-YA5E', fr: 'OZh3BZHCM5s' },
    passage(1, 28, 18, 28, 22),
    [related(9, 16, 1, 16, 13), related(42, 4, 16, 4, 21)]
  ),
  work(
    'bp-theme-holy-spirit',
    'biblical-themes',
    'https://bibleproject.com/videos/holy-spirit/',
    { en: 'oNNZO9i1Gjc', fr: 'n4_ZOaMvpGY' },
    passage(1, 1, 2, 1, 2),
    [related(44, 2, 1, 2, 4)]
  ),
  work(
    'bp-theme-water-of-life',
    'biblical-themes',
    'https://bibleproject.com/videos/water-of-life/',
    { en: 'PgmAkM39Zt4', fr: '0dJXpm668TE' },
    passage(1, 2, 10, 2, 10),
    [related(26, 47, 1, 47, 12), related(43, 4, 7, 4, 14), related(66, 22, 1, 22, 2)]
  ),
  work(
    'bp-theme-son-of-man',
    'biblical-themes',
    'https://bibleproject.com/videos/son-of-man/',
    { en: 'z6cWEcqxhlI', fr: '9lxl6CS1RJk' },
    passage(27, 7, 13, 7, 14),
    [related(41, 14, 61, 14, 64)]
  ),
  work(
    'bp-theme-messiah',
    'biblical-themes',
    'https://bibleproject.com/videos/messiah/',
    { en: '3dEh25pduQ8', fr: '4eBBvA8zzxI' },
    passage(1, 3, 15, 3, 15),
    [related(10, 7, 12, 7, 16), related(23, 11, 1, 11, 10)]
  ),
  work(
    'bp-theme-generosity',
    'biblical-themes',
    'https://bibleproject.com/videos/generosity/',
    { en: '62CliEkRCso', fr: 'fnP-hBi2A2Y' },
    passage(47, 8, 9, 8, 9),
    [related(1, 1, 29, 1, 30), related(42, 12, 13, 12, 34)]
  ),
  work(
    'bp-theme-test',
    'biblical-themes',
    'https://bibleproject.com/videos/the-test/',
    { en: 'sR4AT0LMJ5c', fr: '_oH7LD9MRkc' },
    passage(1, 2, 16, 2, 17),
    [related(1, 22, 1, 22, 19), related(40, 4, 1, 4, 11)]
  ),
]

const youtube = providerId => `https://www.youtube.com/watch?v=${providerId}`

export const BIBLE_PROJECT_THEME_EXCLUSIONS = [
  ['GOXEADdM0ZI', 'en', 'question-and-response'],
  ['NluVlZCToSg', 'en', 'question-and-response'],
  ['mWze68PQa3A', 'en', 'behind-the-scenes'],
  ['x8CuY56_wk4', 'en', 'behind-the-scenes'],
  ['1s7AjhVxDPs', 'en', 'behind-the-scenes'],
  ['zx1YJNZWmuc', 'en', 'behind-the-scenes'],
  ['z4__yO5yBfU', 'en', 'studio-teaser'],
  ['eiJbjmqOD54', 'en', 'studio-teaser'],
  ['npkMrWPDpWI', 'en', 'studio-teaser'],
  ['EgF5fMp4RNM', 'en', 'studio-teaser'],
  ['AKmdcNfnvjc', 'en', 'studio-teaser'],
  ['MlAzDJUE1zY', 'en', 'studio-teaser'],
  ['mI7_EGPyluc', 'en', 'studio-teaser'],
  ['sDwmRiwVzQo', 'en', 'studio-teaser'],
  ['IiQjNBdzsrM', 'en', 'trailer'],
  ['EvldOJ0Z7Jc', 'en', 'group-study-promotion'],
  ['yy7Hesk4NZg', 'en', 'reading-plan-promotion'],
  ['w0iZ-hc7G9M', 'en', 'derivative-short'],
  ['V_UL7evhaBg', 'en', 'derivative-short'],
  ['O1nDieIu8Xc', 'en', 'vertical-9-16-format'],
  ['Ya-EbpCXWpw', 'en', 'duplicate-long-form-compilation'],
  ['FVzc7zXuQzA', 'fr', 'superseded-duplicate'],
].map(([providerId, language, reason]) => ({
  providerId,
  language,
  reason,
  evidenceUrl: youtube(providerId),
}))
