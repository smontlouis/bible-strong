import { createHash } from 'crypto'

const { exportDomComponentAsync } = require('@expo/cli/build/src/export/exportDomComponents') as {
  exportDomComponentAsync: (options: Record<string, unknown>) => Promise<unknown>
}

type DomArtifact = {
  filename: string
  source: string
  type: string
  metadata: { requires?: string[] }
}

const md5Filename = (source: string, type: string) =>
  `${createHash('md5').update(source).digest('hex')}.${type}`

describe('Expo CLI DOM export patch', () => {
  it('keeps chunk dependencies valid when export filenames become content hashes', async () => {
    const commonChunk: DomArtifact = {
      filename: '_expo/static/js/web/__common.js',
      source: 'common source',
      type: 'js',
      metadata: {},
    }
    const entryChunk: DomArtifact = {
      filename: '_expo/static/js/web/entry.js',
      source: 'entry source',
      type: 'js',
      metadata: { requires: [commonChunk.filename] },
    }
    const artifacts = [commonChunk, entryChunk]

    await exportDomComponentAsync({
      filePath: __filename,
      projectRoot: process.cwd(),
      dev: false,
      devServer: {
        legacySinglePageExportBundleAsync: async () => ({ artifacts, assets: [] }),
      },
      isHermes: false,
      includeSourceMaps: false,
      exp: {},
      files: new Map(),
      useMd5Filename: true,
    })

    expect(commonChunk.filename).toBe(md5Filename(commonChunk.source, 'js'))
    expect(entryChunk.filename).toBe(md5Filename(entryChunk.source, 'js'))
    expect(entryChunk.metadata.requires).toEqual([commonChunk.filename])
  })
})
