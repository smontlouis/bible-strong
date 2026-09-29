import { Buffer } from 'buffer'

type ArchiveKey = { version: number; key: Buffer }
type MaskedKey = { version: number; masked: number[]; mask: number[] }

const {
  maskKeys,
  parseArchiveKeys,
  renderKotlin,
  renderSwift,
}: {
  maskKeys: (keys: ArchiveKey[], randomBytes?: (size: number) => Buffer) => MaskedKey[]
  parseArchiveKeys: (value: string | undefined) => ArchiveKey[]
  renderKotlin: (entries: MaskedKey[]) => string
  renderSwift: (entries: MaskedKey[]) => string
} = require('../withBibleStrongArchiveKeys')

const keyOne = Buffer.alloc(32, 7)
const keyTwo = Buffer.alloc(32, 9)

describe('Offline-copy archive key plugin', () => {
  it('parses versioned base64 keys', () => {
    const keys = parseArchiveKeys(
      ` 1:${keyOne.toString('base64')}, 2:${keyTwo.toString('base64')} `
    )

    expect(keys.map(({ version }) => version)).toEqual([1, 2])
    expect(keys[0].key.equals(keyOne)).toBe(true)
    expect(keys[1].key.equals(keyTwo)).toBe(true)
  })

  it('treats a missing variable as no keys', () => {
    expect(parseArchiveKeys(undefined)).toEqual([])
    expect(parseArchiveKeys('  ')).toEqual([])
  })

  it('rejects malformed, short or repeated keys', () => {
    expect(() => parseArchiveKeys(keyOne.toString('base64'))).toThrow('<positive version>')
    expect(() => parseArchiveKeys(`0:${keyOne.toString('base64')}`)).toThrow('<positive version>')
    expect(() => parseArchiveKeys(`1:${Buffer.alloc(16).toString('base64')}`)).toThrow('32 bytes')
    expect(() =>
      parseArchiveKeys(`1:${keyOne.toString('base64')},1:${keyTwo.toString('base64')}`)
    ).toThrow('repeats key version 1')
  })

  it('masks keys so that masked XOR mask restores them', () => {
    const [entry] = maskKeys([{ version: 1, key: keyOne }], size => Buffer.alloc(size, 0x5a))

    expect(entry.masked).not.toEqual([...keyOne])
    expect(entry.masked.map((byte: number, index: number) => byte ^ entry.mask[index])).toEqual([
      ...keyOne,
    ])
  })

  it('never writes the key itself into generated sources', () => {
    const entries = maskKeys([{ version: 1, key: keyOne }])
    const swift = renderSwift(entries)
    const kotlin = renderKotlin(entries)

    for (const source of [swift, kotlin]) {
      expect(source).toContain('never commit')
      expect(source).not.toContain(keyOne.toString('base64'))
      expect(source).not.toContain(`[${[...keyOne].join(', ')}]`)
    }
    expect(swift).toContain('ArchiveKeyMaterialEntry(version: 1, masked: [')
    expect(kotlin).toContain('ArchiveKeyMaterialEntry(1, intArrayOf(')
  })

  it('renders compilable empty tables when the build has no keys', () => {
    expect(renderSwift([])).toContain('static let entries: [ArchiveKeyMaterialEntry] = [\n\n  ]')
    expect(renderKotlin([])).toContain('listOf(\n\n    )')
  })
})
