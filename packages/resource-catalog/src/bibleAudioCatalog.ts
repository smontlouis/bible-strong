import publishedCatalog from './bibleAudioCatalog.json'

/**
 * Where the catalog of recordings is published, on the public media host (ADR-0117). The first
 * key, read by the applications older than 28.2.8, leaves out the recordings whose publisher asks
 * for a mention: those applications cannot show it, so they never hear them.
 */
export const BIBLE_AUDIO_CATALOG_KEY = 'bible-audio/catalog-v2.json'
export const BIBLE_AUDIO_FIRST_CATALOG_KEY = 'bible-audio/catalog.json'
export const BIBLE_AUDIO_CATALOG_URL = `https://media.bible-strong.app/${BIBLE_AUDIO_CATALOG_KEY}`

/**
 * The catalog as the operator publishes it, and as a client keeps it until the media host
 * answers. Read it through `parseBibleAudioCatalog` of the Resource domain.
 */
export const BUNDLED_BIBLE_AUDIO_CATALOG: unknown = publishedCatalog
