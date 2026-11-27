import { parseVrs, type VrsTable } from './vrsParser'

/** The Paratext tables, unchanged (MIT, see paratext/README.md). */
export const PARATEXT_TABLES = ['eng', 'org'] as const
export type ParatextTableId = (typeof PARATEXT_TABLES)[number]

/** The Bible Strong overlays, each listing only what differs from its base. */
export const BIBLE_STRONG_OVERLAYS = ['eng-fixes', 'bs-eng', 'bs-kjv', 'bs-nrsv'] as const
export type BibleStrongOverlayId = (typeof BIBLE_STRONG_OVERLAYS)[number]

export interface VersificationTables {
  paratext: Record<ParatextTableId, VrsTable>
  overlays: Record<BibleStrongOverlayId, VrsTable>
}

/** Reads and parses every source; `read` returns a file of src/versification by its path. */
export const readVersificationSources = async (
  read: (file: string) => Promise<string>
): Promise<VersificationTables> => {
  const paratext = {} as Record<ParatextTableId, VrsTable>
  for (const id of PARATEXT_TABLES) paratext[id] = parseVrs(await read(`paratext/${id}.vrs`))
  const overlays = {} as Record<BibleStrongOverlayId, VrsTable>
  for (const id of BIBLE_STRONG_OVERLAYS) {
    overlays[id] = parseVrs(await read(`bible-strong/${id}.vrs`), { overlay: true })
  }
  return { paratext, overlays }
}
