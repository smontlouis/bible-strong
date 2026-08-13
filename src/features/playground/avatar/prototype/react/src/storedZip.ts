type StoredZipFile = { name: string; content: string }

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

export const createStoredZip = (files: StoredZipFile[]) => {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const centralEntries: Uint8Array[] = []
  let offset = 0
  const header = (size: number) => {
    const bytes = new Uint8Array(size)
    return { bytes, view: new DataView(bytes.buffer) }
  }

  for (const file of files) {
    const name = encoder.encode(file.name)
    const content = encoder.encode(file.content)
    const checksum = crc32(content)
    const local = header(30 + name.length)
    local.view.setUint32(0, 0x04034b50, true)
    local.view.setUint16(4, 20, true)
    local.view.setUint32(14, checksum, true)
    local.view.setUint32(18, content.length, true)
    local.view.setUint32(22, content.length, true)
    local.view.setUint16(26, name.length, true)
    local.bytes.set(name, 30)
    chunks.push(local.bytes, content)

    const central = header(46 + name.length)
    central.view.setUint32(0, 0x02014b50, true)
    central.view.setUint16(4, 20, true)
    central.view.setUint16(6, 20, true)
    central.view.setUint32(16, checksum, true)
    central.view.setUint32(20, content.length, true)
    central.view.setUint32(24, content.length, true)
    central.view.setUint16(28, name.length, true)
    central.view.setUint32(42, offset, true)
    central.bytes.set(name, 46)
    centralEntries.push(central.bytes)
    offset += local.bytes.length + content.length
  }

  const centralSize = centralEntries.reduce((size, entry) => size + entry.length, 0)
  const end = header(22)
  end.view.setUint32(0, 0x06054b50, true)
  end.view.setUint16(8, files.length, true)
  end.view.setUint16(10, files.length, true)
  end.view.setUint32(12, centralSize, true)
  end.view.setUint32(16, offset, true)
  const parts = [...chunks, ...centralEntries, end.bytes].map(
    bytes => Uint8Array.from(bytes).buffer as ArrayBuffer
  )
  return new Blob(parts, { type: 'application/zip' })
}
