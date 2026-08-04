#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const SOURCE_PATH = path.join(OUTPUT_DIR, 'source-snapshot.json')
const CATALOG_PATH = path.join(OUTPUT_DIR, 'catalog.json')
const AUDIT_PATH = path.join(OUTPUT_DIR, 'audit.json')
const CONCURRENCY = Number(process.env.BIBLE_PROJECT_CONCURRENCY || 6)
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

const CHANNELS = [
  {
    language: 'fr',
    handle: 'BibleProject-Fran%C3%A7ais',
    expectedChannelId: 'UC6Plbfso_D_V5z0EQi0Uo8Q',
  },
  {
    language: 'en',
    handle: 'bibleproject',
    expectedChannelId: 'UCVfwlh9XpX2Y_tQfjeln9QA',
  },
]

const BOOKS = [
  [1, ['genesis', 'genese']],
  [2, ['exodus', 'exode']],
  [3, ['leviticus', 'levitique']],
  [4, ['numbers', 'nombres']],
  [5, ['deuteronomy', 'deuteronome']],
  [6, ['joshua', 'josue']],
  [7, ['judges', 'juges']],
  [8, ['ruth']],
  [9, ['1 samuel']],
  [10, ['2 samuel']],
  [11, ['1 2 kings', '1 and 2 kings', '1 2 rois', '1 et 2 rois', 'kings', 'rois']],
  [
    13,
    [
      '1 2 chronicles',
      '1 and 2 chronicles',
      '1 2 chroniques',
      '1 et 2 chroniques',
      'chronicles',
      'chroniques',
    ],
  ],
  [15, ['ezra nehemiah', 'esdras nehemie']],
  [17, ['esther']],
  [18, ['job']],
  [19, ['psalms', 'psalm', 'psaumes', 'psaume']],
  [20, ['proverbs', 'proverbes']],
  [21, ['ecclesiastes', 'ecclesiaste']],
  [22, ['song of songs', 'song of solomon', 'cantique des cantiques']],
  [23, ['isaiah', 'esaie']],
  [24, ['jeremiah', 'jeremie']],
  [25, ['lamentations']],
  [26, ['ezekiel', 'ezechiel']],
  [27, ['daniel']],
  [28, ['hosea', 'osee']],
  [29, ['joel']],
  [30, ['amos']],
  [31, ['obadiah', 'abdias']],
  [32, ['jonah', 'jonas']],
  [33, ['micah', 'michee']],
  [34, ['nahum']],
  [35, ['habakkuk', 'habacuc']],
  [36, ['zephaniah', 'sophonie']],
  [37, ['haggai', 'aggee']],
  [38, ['zechariah', 'zacharie']],
  [39, ['malachi', 'malachie']],
  [40, ['matthew', 'matthieu']],
  [41, ['mark', 'marc']],
  [42, ['luke', 'luc']],
  [43, ['john', 'jean']],
  [44, ['acts', 'actes']],
  [45, ['romans', 'romains']],
  [46, ['1 corinthians', '1 corinthiens']],
  [47, ['2 corinthians', '2 corinthiens']],
  [48, ['galatians', 'galates']],
  [49, ['ephesians', 'ephesiens']],
  [50, ['philippians', 'philippiens']],
  [51, ['colossians', 'colossiens']],
  [52, ['1 thessalonians', '1 thessaloniciens']],
  [53, ['2 thessalonians', '2 thessaloniciens']],
  [54, ['1 timothy', '1 timothee']],
  [55, ['2 timothy', '2 timothee']],
  [56, ['titus', 'tite']],
  [57, ['philemon', 'philemon']],
  [58, ['hebrews', 'hebreux']],
  [59, ['james', 'jacques']],
  [60, ['1 peter', '1 pierre']],
  [61, ['2 peter', '2 pierre']],
  [62, ['1 3 john', '1 3 jean']],
  [65, ['jude']],
  [66, ['revelation', 'apocalypse']],
]

const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeReferenceText = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9:\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const mapLimit = async (items, limit, mapper) => {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

const loadApiKey = () => {
  if (!process.env.YOUTUBE_API_KEY && !process.env.YOUTUBE_DATA_API_KEY) {
    try {
      process.loadEnvFile?.(path.join(ROOT, '.env'))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  const key = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_DATA_API_KEY
  if (!key) {
    throw new Error(
      'Missing YOUTUBE_API_KEY. Set it in the environment or in the ignored root .env file.'
    )
  }
  return key
}

const youtubeGet = async (apiKey, resource, parameters) => {
  const url = new URL(`${YOUTUBE_API_URL}/${resource}`)
  url.search = new URLSearchParams({ ...parameters, key: apiKey })
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || 'unknown'
    throw new Error(`YouTube ${resource} failed (${response.status}, ${reason})`)
  }
  return body
}

const listAll = async (apiKey, resource, parameters) => {
  const items = []
  let pageToken
  do {
    const body = await youtubeGet(apiKey, resource, {
      ...parameters,
      ...(pageToken ? { pageToken } : {}),
    })
    items.push(...(body.items || []))
    pageToken = body.nextPageToken
  } while (pageToken)
  return items
}

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const parseDurationSeconds = duration => {
  const match = String(duration || '').match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  )
  if (!match) return 0
  return Math.round(
    Number(match[1] || 0) * 86_400 +
      Number(match[2] || 0) * 3_600 +
      Number(match[3] || 0) * 60 +
      Number(match[4] || 0)
  )
}

const bestThumbnailUrl = thumbnails => {
  const values = Object.values(thumbnails || {}).filter(item => item?.url)
  return (
    values.sort(
      (a, b) =>
        Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0)
    )[0]?.url || null
  )
}

const compactObject = value =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  )

const extractRelatedVideoIds = description => {
  const ids = new Set()
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/g,
    /youtube\.com\/watch\?[^\s]*?v=([A-Za-z0-9_-]{11})/g,
  ]
  for (const pattern of patterns) {
    for (const match of String(description || '').matchAll(pattern)) ids.add(match[1])
  }
  return [...ids].sort()
}

const extractReferenceMentions = (text, source) => {
  const value = normalizeReferenceText(text)
  const mentions = []
  for (const [book, aliases] of BOOKS) {
    for (const alias of aliases.sort((a, b) => b.length - a.length)) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const pattern = new RegExp(
        `(?:^|\\b)${escaped}\\s+(?:(?:chapter|chapitre|ch)\\s*)?(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*(?:-|a|to)\\s*(\\d{1,3}))?)?(?:\\s*(?:-|a|to)\\s*(\\d{1,3})(?!\\s*:))?`,
        'g'
      )
      for (const match of value.matchAll(pattern)) {
        const mention = {
          book,
          chapterStart: Number(match[1]),
          ...(match[2] ? { verseStart: Number(match[2]) } : {}),
          ...(match[3] ? { verseEnd: Number(match[3]) } : {}),
          ...(match[4] ? { chapterEnd: Number(match[4]) } : {}),
          source,
        }
        const key = JSON.stringify(mention)
        if (!mentions.some(item => JSON.stringify(item) === key)) mentions.push(mention)
      }
    }
  }
  return mentions
}

const extractBookMentions = text => {
  const value = normalize(text)
  const candidates = BOOKS.flatMap(([book, aliases]) =>
    aliases
      .map(normalize)
      .filter(alias => new RegExp(`(?:^|\\s)${alias.replace(/\s+/g, '\\s+')}(?:$|\\s)`).test(value))
      .map(alias => ({ book, alias }))
  )
  return [
    ...new Set(
      candidates
        .filter(
          candidate =>
            !candidates.some(
              other =>
                other.alias.length > candidate.alias.length && other.alias.endsWith(candidate.alias)
            )
        )
        .map(candidate => candidate.book)
    ),
  ].sort((a, b) => a - b)
}

const classifyPlaylist = title => {
  const value = normalize(title)
  if (/studio|process|coulisse/.test(value)) return 'studio'
  if (/podcast/.test(value)) return 'podcast'
  if (/classroom/.test(value)) return 'classroom'
  if (/shorts?/.test(value)) return 'short'
  if (/visual comment|commentaire visuel|sermon on the mount|sermon sur la montagne/.test(value))
    return 'visual-commentary'
  if (/old testament|new testament|panoramas?/.test(value)) return 'book-overview'
  if (/word stud|etude de mots|termes negatifs|shema|advent|avent|character of god/.test(value))
    return 'word-study'
  if (/how to read|comment lire|decouverte de la bible|bible basics/.test(value))
    return 'how-to-read'
  if (/torah|wisdom|sagesse|luke acts|luc actes/.test(value)) return 'book-collection'
  if (
    /theme|commandment|commandement|royal priest|sacerdoce|spiritual|etres spirituels/.test(value)
  )
    return 'theme'
  return null
}

const CATEGORY_PRIORITY = [
  'visual-commentary',
  'book-overview',
  'book-collection',
  'word-study',
  'how-to-read',
  'theme',
  'podcast',
  'classroom',
  'short',
  'studio',
]

const PLAN_COUNTERPART_CORRECTIONS = new Map([
  [
    'fr:350',
    {
      expectedPlanVideoId: 'whrJ5C45tgU',
      correctedVideoId: 'cAOAPSfpbR4',
      reason: 'French plan Apocalypse 1-11 entry points to the Jude video',
    },
  ],
])

const classifyVideo = video => {
  const playlistCategories = video.playlists
    .map(item => classifyPlaylist(item.title))
    .filter(Boolean)
  const title = normalize(video.title)
  let category = CATEGORY_PRIORITY.find(item => playlistCategories.includes(item)) || null
  if (!category) {
    if (/overview|summary|panorama/.test(title)) category = 'book-overview'
    else if (/visual commentary|commentaire visuel/.test(title)) category = 'visual-commentary'
    else if (
      /studio update|behind the scenes|\bbts\b|trailer|coming soon|prochainement/.test(title)
    )
      category = 'studio'
    else if (video.durationSeconds <= 180) category = 'short'
    else if (video.durationSeconds >= 20 * 60) category = 'long-form'
    else category = 'uncategorized'
  }

  const suitability =
    category === 'visual-commentary' || category === 'book-overview'
      ? 'inline-primary'
      : ['book-collection', 'word-study', 'how-to-read', 'theme'].includes(category)
        ? 'related'
        : ['studio', 'classroom', 'podcast'].includes(category)
          ? 'exclude'
          : 'review'
  return { category, suitability }
}

const getPlanData = async sourceVideos => {
  const planFiles = {
    fr: 'src/assets/plans/bible-project-plan.txt',
    en: 'src/assets/plans/bible-project-plan-en.txt',
  }
  const byVideoId = new Map()
  const pairedIds = new Map()
  const pairingCorrections = []
  const sourceById = new Map(sourceVideos.map(video => [video.id, video]))
  for (const [language, file] of Object.entries(planFiles)) {
    const plan = JSON.parse(await readFile(path.join(ROOT, file), 'utf8'))
    for (const section of plan.sections) {
      for (const readingSlice of section.readingSlices) {
        const videos = readingSlice.slices.filter(slice => slice.type === 'Video')
        const references = readingSlice.slices
          .filter(slice => slice.type === 'Chapter' && slice.subType !== 'pray')
          .map(slice => {
            const [book, chapters] = slice.chapters.split('|')
            return { book: Number(book), chapters }
          })
        for (const video of videos) {
          const id = new URL(video.url).searchParams.get('v')
          if (!id) continue
          const occurrences = byVideoId.get(id) || []
          occurrences.push({
            language,
            planId: plan.id,
            sectionId: section.id,
            readingSliceId: readingSlice.id,
            title: video.title,
            references,
          })
          byVideoId.set(id, occurrences)
          const pairKey = `${language}:${readingSlice.id}`
          const correction = PLAN_COUNTERPART_CORRECTIONS.get(pairKey)
          if (correction && correction.expectedPlanVideoId !== id)
            throw new Error(`Plan correction ${pairKey} no longer matches its expected source ID`)
          const counterpartVideoId = correction?.correctedVideoId || id
          const counterpartVideo = sourceById.get(counterpartVideoId)
          if (counterpartVideo?.language === language) {
            pairedIds.set(pairKey, counterpartVideoId)
            if (correction) pairingCorrections.push({ pairKey, ...correction })
          }
        }
      }
    }
  }

  const counterparts = new Map()
  for (const [key, id] of pairedIds) {
    const [language, readingSliceId] = key.split(':')
    const other = pairedIds.get(`${language === 'fr' ? 'en' : 'fr'}:${readingSliceId}`)
    if (other && other !== id) {
      const values = counterparts.get(id) || new Set()
      values.add(other)
      counterparts.set(id, values)
    }
  }
  return { byVideoId, counterparts, pairingCorrections }
}

const sanitizePlaylist = (item, language) => ({
  id: item.id,
  language,
  title: item.snippet?.title || '',
  description: item.snippet?.description || '',
  publishedAt: item.snippet?.publishedAt || null,
  thumbnailUrl: bestThumbnailUrl(item.snippet?.thumbnails),
  channelId: item.snippet?.channelId || null,
  channelTitle: item.snippet?.channelTitle || null,
  privacyStatus: item.status?.privacyStatus || null,
  itemCount: Number(item.contentDetails?.itemCount || 0),
  localizations: item.localizations || {},
  url: `https://www.youtube.com/playlist?list=${item.id}`,
  videoIds: [],
})

const sanitizeVideo = (item, language, playlists) => {
  const snippet = item.snippet || {}
  const contentDetails = item.contentDetails || {}
  const status = item.status || {}
  const statistics = item.statistics || {}
  const detectedLanguage = snippet.defaultAudioLanguage || snippet.defaultLanguage || null
  const availability =
    status.privacyStatus === 'public' && status.uploadStatus === 'processed'
      ? 'public'
      : status.privacyStatus || status.uploadStatus || 'unknown'

  return compactObject({
    id: item.id,
    title: snippet.title || '',
    description: snippet.description || '',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    thumbnailUrl: bestThumbnailUrl(snippet.thumbnails),
    thumbnails: snippet.thumbnails || {},
    duration: contentDetails.duration || null,
    durationSeconds: parseDurationSeconds(contentDetails.duration),
    publishedAt: snippet.publishedAt || null,
    language,
    channelId: snippet.channelId || null,
    channelTitle: snippet.channelTitle || null,
    categoryId: snippet.categoryId || null,
    tags: snippet.tags || [],
    defaultLanguage: snippet.defaultLanguage || null,
    defaultAudioLanguage: snippet.defaultAudioLanguage || null,
    detectedLanguage,
    liveBroadcastContent: snippet.liveBroadcastContent || null,
    metadataStatus: 'complete',
    availability,
    uploadStatus: status.uploadStatus || null,
    privacyStatus: status.privacyStatus || null,
    license: status.license || null,
    embeddable: status.embeddable ?? null,
    publicStatsViewable: status.publicStatsViewable ?? null,
    madeForKids: status.madeForKids ?? null,
    selfDeclaredMadeForKids: status.selfDeclaredMadeForKids ?? null,
    captionsAvailable: contentDetails.caption === 'true',
    definition: contentDetails.definition || null,
    dimension: contentDetails.dimension || null,
    projection: contentDetails.projection || null,
    licensedContent: contentDetails.licensedContent ?? null,
    hasCustomThumbnail: contentDetails.hasCustomThumbnail ?? null,
    regionRestriction: contentDetails.regionRestriction || null,
    contentRating: contentDetails.contentRating || {},
    statistics: compactObject({
      viewCount: statistics.viewCount ? Number(statistics.viewCount) : undefined,
      likeCount: statistics.likeCount ? Number(statistics.likeCount) : undefined,
      favoriteCount: statistics.favoriteCount ? Number(statistics.favoriteCount) : undefined,
      commentCount: statistics.commentCount ? Number(statistics.commentCount) : undefined,
    }),
    topicCategories: item.topicDetails?.topicCategories || [],
    recordingDate: item.recordingDetails?.recordingDate || null,
    localizations: item.localizations || {},
    liveStreamingDetails: item.liveStreamingDetails || null,
    playlists,
    relatedVideoIds: extractRelatedVideoIds(snippet.description),
    referenceMentions: [
      ...extractReferenceMentions(snippet.title, 'title'),
      ...extractReferenceMentions(snippet.description, 'description'),
    ],
  })
}

const validateSource = source => {
  const expectedVideos = source.channels.reduce((sum, channel) => sum + channel.videoCount, 0)
  const videoIds = source.videos.map(video => video.id)
  const playlistIds = source.playlists.map(playlist => playlist.id)
  if (source.videos.length !== expectedVideos)
    throw new Error(`Expected ${expectedVideos} videos, received ${source.videos.length}`)
  if (new Set(videoIds).size !== videoIds.length) throw new Error('Duplicate videos in source')
  if (new Set(playlistIds).size !== playlistIds.length)
    throw new Error('Duplicate playlists in source')

  const channelIdsByLanguage = new Map(
    source.channels.map(channel => [channel.language, channel.channelId])
  )
  for (const video of source.videos) {
    if (!video.id || !video.title || !video.publishedAt)
      throw new Error(`Incomplete required metadata for ${video.id || 'unknown video'}`)
    if (video.channelId !== channelIdsByLanguage.get(video.language))
      throw new Error(`Unexpected channel for ${video.id}`)
    if (video.metadataStatus !== 'complete')
      throw new Error(`Incomplete API metadata for ${video.id}`)
    if (typeof video.embeddable !== 'boolean')
      throw new Error(`Missing embeddable status for ${video.id}`)
    if (typeof video.madeForKids !== 'boolean')
      throw new Error(`Missing Made-for-Kids status for ${video.id}`)
  }
}

const main = async () => {
  const apiKey = loadApiKey()
  await mkdir(OUTPUT_DIR, { recursive: true })
  const channelResults = []
  const playlistResults = []
  const videoLanguage = new Map()
  const uploadVideoIds = []

  for (const channel of CHANNELS) {
    process.stderr.write(`Collecting ${channel.language} channel through YouTube Data API...\n`)
    const base = `https://www.youtube.com/@${channel.handle}`
    const [channelBody, playlistItems] = await Promise.all([
      youtubeGet(apiKey, 'channels', {
        part: 'snippet,contentDetails,statistics,status,topicDetails,brandingSettings,localizations',
        id: channel.expectedChannelId,
        maxResults: '1',
      }),
      listAll(apiKey, 'playlists', {
        part: 'snippet,contentDetails,status,localizations',
        channelId: channel.expectedChannelId,
        maxResults: '50',
      }),
    ])
    const channelItem = channelBody.items?.[0]
    if (!channelItem || channelItem.id !== channel.expectedChannelId)
      throw new Error(`Expected channel ${channel.expectedChannelId} was not returned`)

    const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) throw new Error(`Missing uploads playlist for ${channel.language}`)

    const uploads = await listAll(apiKey, 'playlistItems', {
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
    })
    const channelVideoIds = uploads.map(item => item.contentDetails?.videoId).filter(Boolean)
    for (const id of channelVideoIds) {
      if (videoLanguage.has(id)) throw new Error(`Video ${id} belongs to both configured channels`)
      videoLanguage.set(id, channel.language)
      uploadVideoIds.push(id)
    }

    const playlists = playlistItems.map(item => sanitizePlaylist(item, channel.language))
    channelResults.push({
      language: channel.language,
      channelId: channelItem.id,
      title: channelItem.snippet?.title || '',
      description: channelItem.snippet?.description || '',
      customUrl: channelItem.snippet?.customUrl || null,
      publishedAt: channelItem.snippet?.publishedAt || null,
      defaultLanguage: channelItem.snippet?.defaultLanguage || null,
      country: channelItem.snippet?.country || null,
      url: `${base}/videos`,
      uploadsPlaylistId,
      videoCount: channelVideoIds.length,
      playlistCount: playlists.length,
      statistics: compactObject({
        viewCount: channelItem.statistics?.viewCount
          ? Number(channelItem.statistics.viewCount)
          : undefined,
        subscriberCount: channelItem.statistics?.subscriberCount
          ? Number(channelItem.statistics.subscriberCount)
          : undefined,
        hiddenSubscriberCount: channelItem.statistics?.hiddenSubscriberCount,
        videoCount: channelItem.statistics?.videoCount
          ? Number(channelItem.statistics.videoCount)
          : undefined,
      }),
      status: channelItem.status || {},
      topicCategories: channelItem.topicDetails?.topicCategories || [],
      localizations: channelItem.localizations || {},
    })

    const memberships = await mapLimit(playlists, CONCURRENCY, async playlist => {
      const items = await listAll(apiKey, 'playlistItems', {
        part: 'contentDetails',
        playlistId: playlist.id,
        maxResults: '50',
      })
      const videoIds = items.map(item => item.contentDetails?.videoId).filter(Boolean)
      process.stderr.write(
        `  ${channel.language} playlist: ${playlist.title} (${videoIds.length})\n`
      )
      return { ...playlist, videoIds }
    })
    playlistResults.push(...memberships)
  }

  if (new Set(uploadVideoIds).size !== uploadVideoIds.length)
    throw new Error('Duplicate video IDs found in channel uploads')

  const playlistsByVideoId = new Map()
  for (const playlist of playlistResults) {
    for (const id of playlist.videoIds) {
      if (!videoLanguage.has(id)) continue
      const values = playlistsByVideoId.get(id) || []
      values.push({ id: playlist.id, title: playlist.title })
      playlistsByVideoId.set(id, values)
    }
  }

  process.stderr.write(`Collecting metadata for ${uploadVideoIds.length} videos...\n`)
  const videoItems = (
    await mapLimit(chunk(uploadVideoIds, 50), CONCURRENCY, ids =>
      youtubeGet(apiKey, 'videos', {
        part: 'snippet,contentDetails,status,statistics,topicDetails,recordingDetails,liveStreamingDetails,localizations',
        id: ids.join(','),
        maxResults: '50',
      })
    )
  ).flatMap(body => body.items || [])
  const returnedIds = new Set(videoItems.map(item => item.id))
  const missingVideoIds = uploadVideoIds.filter(id => !returnedIds.has(id))
  if (missingVideoIds.length) {
    throw new Error(`YouTube did not return metadata for ${missingVideoIds.length} upload(s)`)
  }

  const enriched = videoItems.map(item =>
    sanitizeVideo(item, videoLanguage.get(item.id), playlistsByVideoId.get(item.id) || [])
  )

  enriched.sort((a, b) => a.language.localeCompare(b.language) || a.title.localeCompare(b.title))
  const source = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    collector: 'scripts/collect-bible-project-videos.mjs',
    provider: 'youtube-data-api-v3',
    channels: channelResults,
    playlists: playlistResults.sort(
      (a, b) => a.language.localeCompare(b.language) || a.title.localeCompare(b.title)
    ),
    videos: enriched,
  }
  source.refreshDueAt = new Date(
    new Date(source.generatedAt).getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  validateSource(source)
  await writeFile(SOURCE_PATH, `${JSON.stringify(source, null, 2)}\n`)

  const { byVideoId, counterparts, pairingCorrections } = await getPlanData(enriched)
  const catalogVideos = enriched.map(video => {
    const classification = classifyVideo(video)
    const planOccurrences = byVideoId.get(video.id) || []
    return {
      id: video.id,
      language: video.language,
      title: video.title,
      provider: 'youtube',
      providerId: video.id,
      sourceUrl: video.url,
      thumbnailUrl: video.thumbnailUrl,
      description: video.description,
      durationSeconds: video.durationSeconds,
      publishedAt: video.publishedAt,
      metadataStatus: video.metadataStatus,
      availability: video.availability,
      embeddable: video.embeddable,
      madeForKids: video.madeForKids,
      captionsAvailable: video.captionsAvailable,
      defaultLanguage: video.defaultLanguage,
      defaultAudioLanguage: video.defaultAudioLanguage,
      regionRestriction: video.regionRestriction,
      ...classification,
      playlists: video.playlists,
      localizedCounterpartIds: [...(counterparts.get(video.id) || [])].sort(),
      bookMentions: extractBookMentions(video.title),
      referenceMentions: video.referenceMentions,
      relatedVideoIds: video.relatedVideoIds,
      planOccurrences,
    }
  })

  const catalog = {
    schemaVersion: 2,
    generatedAt: source.generatedAt,
    refreshDueAt: source.refreshDueAt,
    attribution: {
      owner: 'BibleProject',
      url: 'https://bibleproject.com/',
      termsUrl: 'https://bibleproject.com/terms/',
    },
    videos: catalogVideos,
  }
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`)

  const countBy = (items, key) =>
    Object.fromEntries(
      [...new Set(items.map(item => item[key]))]
        .sort()
        .map(value => [value, items.filter(item => item[key] === value).length])
    )
  const duplicatePlanTitles = [...byVideoId.entries()]
    .filter(([, occurrences]) => new Set(occurrences.map(item => item.title)).size > 1)
    .map(([id, occurrences]) => ({
      id,
      titles: [...new Set(occurrences.map(item => item.title))],
      occurrences,
    }))
  const audit = {
    schemaVersion: 2,
    generatedAt: source.generatedAt,
    refreshDueAt: source.refreshDueAt,
    totals: {
      videos: catalogVideos.length,
      playlists: playlistResults.length,
      frenchVideos: catalogVideos.filter(video => video.language === 'fr').length,
      englishVideos: catalogVideos.filter(video => video.language === 'en').length,
      inExistingPlans: catalogVideos.filter(video => video.planOccurrences.length).length,
      withLocalizedCounterpart: catalogVideos.filter(video => video.localizedCounterpartIds.length)
        .length,
      withReferenceMentions: catalogVideos.filter(video => video.referenceMentions.length).length,
      metadataVerified: enriched.filter(video => video.metadataStatus === 'complete').length,
      metadataUnverified: enriched.filter(video => video.metadataStatus !== 'complete').length,
      availabilityPublic: catalogVideos.filter(video => video.availability === 'public').length,
      embeddable: catalogVideos.filter(video => video.embeddable === true).length,
      notEmbeddable: catalogVideos.filter(video => video.embeddable === false).length,
      madeForKids: catalogVideos.filter(video => video.madeForKids === true).length,
      captionsAvailable: catalogVideos.filter(video => video.captionsAvailable === true).length,
      regionRestricted: catalogVideos.filter(video => video.regionRestriction).length,
    },
    byCategory: countBy(catalogVideos, 'category'),
    bySuitability: countBy(catalogVideos, 'suitability'),
    duplicatePlanTitles,
    pairingCorrections,
    uncategorizedIds: catalogVideos
      .filter(video => video.category === 'uncategorized')
      .map(video => video.id),
    reviewIds: catalogVideos.filter(video => video.suitability === 'review').map(video => video.id),
  }
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)
  process.stderr.write(`Wrote ${SOURCE_PATH}\nWrote ${CATALOG_PATH}\nWrote ${AUDIT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
