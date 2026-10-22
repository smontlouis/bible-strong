import * as FileSystem from 'expo-file-system/legacy'
import type { TabGroup, TabItem } from '~state/tabs'
import {
  TAB_PREVIEWS_DIRECTORY,
  deleteTabPreviewFile,
  rebaseTabPreviewUris,
  saveTabPreviewFile,
  settleTabPreviewFile,
  sweepTabPreviewFiles,
  tabPreviewFilePath,
} from '../tabPreviewFiles'

const mockFiles = new Set<string>()
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(async () => {}),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.delete(from)) throw new Error(`No file at ${from}`)
    mockFiles.add(to)
  }),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.has(from)) throw new Error(`No file at ${from}`)
    mockFiles.add(to)
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    mockFiles.delete(uri)
  }),
  readDirectoryAsync: jest.fn(async (directory: string) =>
    [...mockFiles].filter(uri => uri.startsWith(directory)).map(uri => uri.slice(directory.length))
  ),
}))

const directory = 'file:///documents/tab-previews/'

const tab = (id: string, previewUri?: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
  previewUri,
})

const group = (tabs: TabItem[], id = 'group'): TabGroup => ({
  id,
  name: id,
  isDefault: false,
  tabs,
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: 1,
})

beforeEach(() => {
  mockFiles.clear()
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(1000)
})

afterEach(() => jest.restoreAllMocks())

it('keeps previews in a directory of the document directory', () => {
  expect(TAB_PREVIEWS_DIRECTORY).toBe(directory)
})

it('moves a capture onto the file of its tab, its address carrying the capture version', async () => {
  // iOS hands back a plain path.
  mockFiles.add('file:///tmp/ReactNative/capture.jpg')

  const uri = await saveTabPreviewFile('bible-1', '/tmp/ReactNative/capture.jpg')

  expect(uri).toBe(`${directory}bible-1.jpg?v=1000`)
  expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(directory, { intermediates: true })
  expect([...mockFiles]).toEqual([`${directory}bible-1.jpg`])
})

it('overwrites the file of its tab at each capture, under a new version', async () => {
  mockFiles.add(`${directory}a.jpg`)
  mockFiles.add('file:///tmp/capture.jpg')
  jest.mocked(Date.now).mockReturnValue(2000)

  const uri = await saveTabPreviewFile('a', 'file:///tmp/capture.jpg')

  expect(uri).toBe(`${directory}a.jpg?v=2000`)
  expect([...mockFiles]).toEqual([`${directory}a.jpg`])
})

it('copies the capture when it cannot be renamed across volumes', async () => {
  mockFiles.add('file:///external/cache/capture.jpg')
  jest.mocked(FileSystem.moveAsync).mockRejectedValueOnce(new Error('EXDEV'))

  const uri = await saveTabPreviewFile('tab/1', 'file:///external/cache/capture.jpg')

  expect(uri).toBe(`${directory}tab_1.jpg?v=1000`)
  expect([...mockFiles]).toEqual([`${directory}tab_1.jpg`])
})

it('deletes the capture when it cannot be kept', async () => {
  mockFiles.add('file:///tmp/capture.jpg')
  jest.mocked(FileSystem.moveAsync).mockRejectedValueOnce(new Error('full'))
  jest.mocked(FileSystem.copyAsync).mockRejectedValueOnce(new Error('full'))

  await expect(saveTabPreviewFile('a', 'file:///tmp/capture.jpg')).rejects.toThrow('full')
  expect(mockFiles.size).toBe(0)
})

it('sweeps the files no tab refers to, in every group', async () => {
  const kept = `${directory}a.jpg`
  const keptInOtherGroup = `${directory}b.jpg`
  const closed = `${directory}c.jpg`
  for (const uri of [kept, keptInOtherGroup, closed]) mockFiles.add(uri)
  mockFiles.add('file:///documents/other.json')

  await sweepTabPreviewFiles(() => [
    group([tab('a', `${kept}?v=5`), tab('new')]),
    group([tab('b', `${keptInOtherGroup}?v=7`)], 'other'),
  ])

  expect([...mockFiles].sort()).toEqual(
    [keptInOtherGroup, kept, 'file:///documents/other.json'].sort()
  )
})

it('leaves a capture alone until it is set on its tab', async () => {
  mockFiles.add('file:///tmp/capture.jpg')
  const uri = await saveTabPreviewFile('a', 'file:///tmp/capture.jpg')
  const file = tabPreviewFilePath(uri)

  await sweepTabPreviewFiles(() => [group([tab('a')])])
  expect(mockFiles.has(file)).toBe(true)

  settleTabPreviewFile(uri)
  await sweepTabPreviewFiles(() => [group([tab('a')])])
  expect(mockFiles.has(file)).toBe(false)
})

it('reads the groups after listing the directory', async () => {
  const file = `${directory}a.jpg`
  mockFiles.add(file)
  let groups = [group([tab('a')])]
  jest.mocked(FileSystem.readDirectoryAsync).mockImplementationOnce(async () => {
    // A capture is set on its tab while the directory is being read.
    groups = [group([tab('a', `${file}?v=1`)])]
    return ['a.jpg']
  })

  await sweepTabPreviewFiles(() => groups)

  expect(mockFiles.has(file)).toBe(true)
})

it('does nothing before the first preview is saved', async () => {
  jest.mocked(FileSystem.readDirectoryAsync).mockRejectedValueOnce(new Error('No directory'))

  await expect(sweepTabPreviewFiles(() => [])).resolves.toBeUndefined()
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled()
})

it('deletes only files of the previews directory', async () => {
  await deleteTabPreviewFile('data:image/jpeg;base64,AAAA')
  expect(FileSystem.deleteAsync).not.toHaveBeenCalled()

  mockFiles.add(`${directory}a.jpg`)
  await deleteTabPreviewFile(`${directory}a.jpg?v=1`)
  expect(mockFiles.size).toBe(0)
})

it('finds previews again after iOS moved the app container', () => {
  const current = `${directory}b.jpg?v=1`
  const groups = [
    group([
      tab(
        'a',
        'file:///var/mobile/Containers/Data/Application/OLD/Documents/tab-previews/a.jpg?v=1'
      ),
      tab('b', current),
      tab('c'),
    ]),
    group([tab('d', current)], 'untouched'),
  ]

  const rebased = rebaseTabPreviewUris(groups)

  expect(rebased?.[0].tabs.map(item => item.previewUri)).toEqual([
    `${directory}a.jpg?v=1`,
    current,
    undefined,
  ])
  expect(rebased?.[0].updatedAt).toBe(1)
  expect(rebased?.[1]).toBe(groups[1])
  expect(rebaseTabPreviewUris([groups[1]])).toBeUndefined()
})
