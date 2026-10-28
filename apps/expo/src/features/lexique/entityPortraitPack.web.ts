import type { EntityPortraitSize } from './entityPortraits'

// The offline pack exists only on iOS and Android: the browser's cache stands in for it (ADR-0089).

export const ENTITY_PORTRAIT_PACK_BYTES_PER_PICTURE = 62_000

export type EntityPortraitPackProgress = {
  status: 'idle' | 'syncing' | 'failed'
  done: number
  total: number
}

const NO_PICTURES: ReadonlySet<string> = new Set()

export const getEntityPortraitLocalUri = (hash: string, size: EntityPortraitSize) =>
  `${hash}/${size}.webp`

export const syncEntityPortraitPack = async () => undefined

export const requestEntityPortraitPack = async () => undefined

export const removeEntityPortraitPack = async () => undefined

export const useEntityPortraitPack = () => ({ requested: false, hashes: [] as string[] })

export const useEntityPortraitPackProgress = (): EntityPortraitPackProgress => ({
  status: 'idle',
  done: 0,
  total: 0,
})

export const useEntityPortraitLocalHashes = () => NO_PICTURES
