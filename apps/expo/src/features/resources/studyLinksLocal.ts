import {
  readStudyLinks,
  type StudyLinkRow,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { getStudyLinksDbPath } from '~helpers/databases'
import { openSQLiteDatabase } from '~helpers/sqlite'
import { offlineResourceRegistry } from './resourceAvailability'
import type { StudyLinksAccess } from './studyLinksAccess'

const identity = { kind: 'study-links' as const }

const LINKS_OF_A_SUBJECT = `
  SELECT node.kind, node.key, node.label_fr, node.label_en, node.detail_fr, node.detail_en,
         node.language, node.position, link.role
  FROM study_links link
  JOIN study_link_nodes node ON node.kind = link.right_kind AND node.key = link.right_key
  WHERE link.left_kind = ? AND link.left_key = ?
  UNION ALL
  SELECT node.kind, node.key, node.label_fr, node.label_en, node.detail_fr, node.detail_en,
         node.language, node.position, link.role
  FROM study_links link
  JOIN study_link_nodes node ON node.kind = link.left_kind AND node.key = link.left_key
  WHERE link.right_kind = ? AND link.right_key = ?
`

export const isStudyLinksInstalled = async () =>
  (await offlineResourceRegistry.getAvailability(identity)).status === 'available'

export const localStudyLinksAccess: StudyLinksAccess = {
  load: async ({ kind, key }, language) => {
    const databasePath = getStudyLinksDbPath()
    const fileName = databasePath.split('/').pop()!
    const directory = databasePath.slice(0, -(fileName.length + 1))
    const database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
    try {
      const rows = await database.getAllAsync<StudyLinkRow>(LINKS_OF_A_SUBJECT, [
        kind,
        key,
        kind,
        key,
      ])
      return readStudyLinks(kind, language, rows)
    } catch (error) {
      offlineResourceRegistry.markCorrupt(identity)
      throw error
    } finally {
      await database.closeAsync()
    }
  },
}
