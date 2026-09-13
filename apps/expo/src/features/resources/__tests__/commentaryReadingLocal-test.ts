/* eslint-disable import/first */
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documents/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}))
jest.mock('~helpers/databases', () => ({ getCommentaryDbPath: jest.fn() }))
jest.mock('~helpers/sqlite', () => ({ openSQLiteDatabase: jest.fn() }))
jest.mock('../resourceAvailability', () => ({ getLocalResourceAvailability: jest.fn() }))
jest.mock('../commentaryAccess', () => ({
  localCommentaryChapterSource: { loadResourceChapter: jest.fn() },
}))

import * as FileSystem from 'expo-file-system/legacy'
import { getCommentaryDbPath } from '~helpers/databases'
import { openSQLiteDatabase } from '~helpers/sqlite'
import { getLocalResourceAvailability } from '../resourceAvailability'
import { localCommentaryChapterSource } from '../commentaryAccess'
import { localCommentaryReading } from '../commentaryReadingLocal'

const request = {
  resourceId: 'barnes',
  language: 'fr' as const,
  revision: 'r1',
  book: 1,
  chapter: 1,
  sectionId: 'barnes-fr-1-1-1-2',
}

function harness({ projection = false } = {}) {
  let revision = 'r1'
  const files = new Map<string, string>()
  const database = {
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('RESOURCE_METADATA')) return { revision }
      if (sql.includes('sqlite_master'))
        return projection ? { name: 'COMMENTARY_READING_SECTIONS' } : null
      return null
    }),
    getAllAsync: jest.fn(async (_sql: string) => [
      {
        id: request.sectionId,
        range_start_verse: 1,
        range_end_verse: 2,
        excerpt: 'Preview',
      },
    ]),
    closeAsync: jest.fn(async () => {}),
  }
  jest.mocked(getLocalResourceAvailability).mockResolvedValue({ status: 'available' } as never)
  jest.mocked(getCommentaryDbPath).mockReturnValue('/documents/SQLite/barnes.sqlite')
  jest.mocked(openSQLiteDatabase).mockResolvedValue(database as never)
  jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async path => {
    const value = files.get(path)
    if (!value) throw new Error('missing file')
    return value
  })
  jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (path, contents) => {
    files.set(path, contents)
  })
  jest.mocked(localCommentaryChapterSource.loadResourceChapter).mockResolvedValue({
    1: '<p>Complete commentary.</p>',
    2: '<p>Complete commentary.</p>',
  })
  return {
    database,
    files,
    setRevision: (value: string) => {
      revision = value
    },
  }
}

beforeEach(() => jest.clearAllMocks())

it('reads normalized documents once with lightweight associations for a selected section', async () => {
  harness()
  const database = {
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('RESOURCE_METADATA') ? { revision: 'r1' } : { name: 'COMMENTARY_DOCUMENTS' }
    ),
    getAllAsync: jest.fn(async (sql: string) =>
      sql.startsWith('SELECT id, content')
        ? [{ id: 'a', content: '<p>Only one document body.</p>' }]
        : [
            { verse_key: '1-1-1', document_id: 'a', ordinal: 0 },
            { verse_key: '1-1-2', document_id: 'a', ordinal: 0 },
          ]
    ),
    closeAsync: jest.fn(async () => {}),
  }
  jest.mocked(openSQLiteDatabase).mockResolvedValue(database as never)
  const result = await localCommentaryReading.section(request)
  expect(result?.section.content).toBe('<p>Only one document body.</p>')
  expect(localCommentaryChapterSource.loadResourceChapter).not.toHaveBeenCalled()
  expect(database.getAllAsync.mock.calls.every(([sql]) => !sql.includes('JOIN'))).toBe(true)
  expect(database.getAllAsync.mock.calls.every(([sql]) => sql.includes('verse_key >= ?'))).toBe(
    true
  )
})

it('reads only the projection for new copies, without loading a chapter body', async () => {
  const h = harness({ projection: true })
  const result = await localCommentaryReading.index('barnes', 'fr', 1, 1)
  expect(result?.sections[0].excerpt).toBe('Preview')
  const sql = h.database.getAllAsync.mock.calls[0]?.[0]
  expect(sql).not.toMatch(/\bcontent\b/)
  expect(localCommentaryChapterSource.loadResourceChapter).not.toHaveBeenCalled()
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled()
  expect(h.database.closeAsync).toHaveBeenCalledTimes(1)
})

it('migrates only a visited legacy chapter to a separate sidecar and reuses it', async () => {
  const h = harness()
  const result = await localCommentaryReading.index('barnes', 'fr', 1, 1)
  expect(result?.sections[0]).toMatchObject({
    id: request.sectionId,
    excerpt: 'Complete commentary.',
  })
  expect([...h.files.keys()]).toEqual([
    '/documents/commentary-reading-index-v1/barnes%3Afr%3Ar1%3A1%3A1.json',
  ])
  expect([...h.files.values()][0]).not.toContain('<p>')
  await localCommentaryReading.index('barnes', 'fr', 1, 1)
  expect(localCommentaryChapterSource.loadResourceChapter).toHaveBeenCalledTimes(1)
  const opened = await localCommentaryReading.section(request)
  expect(opened?.section.content).toBe('<p>Complete commentary.</p>')
  expect(opened?.resource.revision).toBe('r1')
})

it('does not save a legacy index when the installed revision changes while reading', async () => {
  const h = harness()
  jest.mocked(localCommentaryChapterSource.loadResourceChapter).mockImplementation(async () => {
    h.setRevision('r2')
    return { 1: '<p>New edition.</p>' }
  })
  await expect(localCommentaryReading.index('barnes', 'fr', 1, 1)).rejects.toThrow(
    'COMMENTARY_REVISION_CHANGED'
  )
  expect(h.files.size).toBe(0)
  await expect(localCommentaryReading.section(request)).resolves.toBeUndefined()
})

it('closes the SQLite connection if metadata cannot be read', async () => {
  const h = harness()
  h.database.getFirstAsync.mockRejectedValueOnce(new Error('broken metadata'))
  await expect(localCommentaryReading.index('barnes', 'fr', 1, 1)).rejects.toThrow(
    'broken metadata'
  )
  expect(h.database.closeAsync).toHaveBeenCalledTimes(1)
})
