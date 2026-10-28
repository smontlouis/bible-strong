import * as FileSystem from 'expo-file-system/legacy'
import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { useMemo } from 'react'

import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { entityPortraitCatalogAtom } from './entityPortraitCatalogAtom'
import {
  getEntityPortraitPictures,
  getEntityPortraitUri,
  planEntityPortraitPack,
  type EntityPortraitSize,
} from './entityPortraits'

// The offline pack of portraits (ADR-0089): the 256- and 768-pixel copies of every picture the
// catalog names, one folder per hash in the application's documents.
const PACK_FOLDER = `${FileSystem.documentDirectory}entity-portraits/`
const PACK_SIZES: EntityPortraitSize[] = ['w256', 'w768']
const CONCURRENT_DOWNLOADS = 4

/** About 62 KB per picture for its two copies, measured on 2026-10-28. */
export const ENTITY_PORTRAIT_PACK_BYTES_PER_PICTURE = 62_000

type EntityPortraitPackState = {
  /** The reader asked for the pack; it then follows each new catalog. */
  requested: boolean
  /** The pictures whose two copies are on the device. */
  hashes: string[]
}

export type EntityPortraitPackProgress = {
  status: 'idle' | 'syncing' | 'failed'
  done: number
  total: number
}

const entityPortraitPackAtom = atomWithAsyncStorage<EntityPortraitPackState>('entityPortraitPack', {
  requested: false,
  hashes: [],
})

const entityPortraitPackProgressAtom = atom<EntityPortraitPackProgress>({
  status: 'idle',
  done: 0,
  total: 0,
})

export const getEntityPortraitLocalUri = (hash: string, size: EntityPortraitSize) =>
  `${PACK_FOLDER}${hash}/${size}.webp`

const downloadPicture = async (uniqueName: string, hash: string) => {
  await FileSystem.makeDirectoryAsync(`${PACK_FOLDER}${hash}`, { intermediates: true })
  for (const size of PACK_SIZES) {
    const { status } = await FileSystem.downloadAsync(
      getEntityPortraitUri(uniqueName, hash, size),
      getEntityPortraitLocalUri(hash, size)
    )
    if (status !== 200) throw new Error(`ENTITY_PORTRAIT_PACK_DOWNLOAD_FAILED: ${status}`)
  }
}

// Removing the pack moves to a new generation: a sync of an older one stops recording pictures.
let generation = 0
let pending: Promise<void> = Promise.resolve()

const runSync = async () => {
  const store = getDefaultStore()
  const run = generation
  const state = store.get(entityPortraitPackAtom)
  const catalog = store.get(entityPortraitCatalogAtom)?.catalog
  if (!state.requested || !catalog) return

  const pictures = getEntityPortraitPictures(catalog)
  const { missing, obsolete } = planEntityPortraitPack(
    pictures.map(picture => picture.hash),
    state.hashes
  )
  for (const hash of obsolete) {
    await FileSystem.deleteAsync(`${PACK_FOLDER}${hash}`, { idempotent: true })
  }
  if (obsolete.length) {
    store.set(entityPortraitPackAtom, current => ({
      ...current,
      hashes: current.hashes.filter(hash => !obsolete.includes(hash)),
    }))
  }

  const owners = new Map(pictures.map(picture => [picture.hash, picture.uniqueName]))
  const total = pictures.length
  let done = total - missing.length
  let failed = 0
  store.set(entityPortraitPackProgressAtom, {
    status: missing.length ? 'syncing' : 'idle',
    done,
    total,
  })

  const queue = [...missing]
  const worker = async () => {
    for (let hash = queue.shift(); hash; hash = queue.shift()) {
      if (run !== generation) return
      try {
        await downloadPicture(owners.get(hash)!, hash)
        if (run !== generation) return
        const downloaded = hash
        store.set(entityPortraitPackAtom, current => ({
          ...current,
          hashes: [...current.hashes, downloaded],
        }))
        done += 1
      } catch {
        // Offline or unreachable: the picture is fetched again at the next sync.
        failed += 1
      }
      store.set(entityPortraitPackProgressAtom, { status: 'syncing', done, total })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENT_DOWNLOADS }, worker))
  if (run !== generation) return
  store.set(entityPortraitPackProgressAtom, { status: failed ? 'failed' : 'idle', done, total })
}

/** Brings the pack in line with the catalog, if the reader asked for it. One sync at a time. */
export const syncEntityPortraitPack = () => {
  pending = pending.then(runSync).catch(() => undefined)
  return pending
}

export const requestEntityPortraitPack = () => {
  getDefaultStore().set(entityPortraitPackAtom, current => ({ ...current, requested: true }))
  return syncEntityPortraitPack()
}

export const removeEntityPortraitPack = async () => {
  const store = getDefaultStore()
  generation += 1
  store.set(entityPortraitPackAtom, { requested: false, hashes: [] })
  await pending
  await FileSystem.deleteAsync(PACK_FOLDER, { idempotent: true })
  store.set(entityPortraitPackProgressAtom, { status: 'idle', done: 0, total: 0 })
}

export const useEntityPortraitPack = () => useAtomValue(entityPortraitPackAtom)

export const useEntityPortraitPackProgress = () => useAtomValue(entityPortraitPackProgressAtom)

/** The pictures this device holds offline. */
export const useEntityPortraitLocalHashes = (): ReadonlySet<string> => {
  const { hashes } = useAtomValue(entityPortraitPackAtom)
  return useMemo(() => new Set(hashes), [hashes])
}
