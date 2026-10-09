import {
  SHARE_CARD_DESIGN,
  SHARE_CARD_KINDS,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'

/**
 * The address of a share image carries what the image shows, signed by the site. Whoever asks
 * for the image hands the drawing its own description: nothing is read back, from the page
 * or from the Resource API. The signature is what keeps the drawing from writing a text the
 * site never wrote under its mark.
 *
 * Head builders run in the browser too, where there is no secret and no need for one: only
 * the page the server renders is read by the networks. Everything here is therefore plain,
 * synchronous code, with no Node module.
 */

// SHA-256 and HMAC, as FIPS 180-4 and RFC 2104 write them.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))

export const sha256 = (message: Uint8Array): Uint8Array => {
  const length = message.length
  const padded = new Uint8Array((((length + 8) >> 6) + 1) << 6)
  padded.set(message)
  padded[length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000))
  view.setUint32(padded.length - 4, (length << 3) >>> 0)

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const words = new Uint32Array(64)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]
      const b = words[index - 2]
      words[index] =
        (words[index - 16] +
          (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) +
          words[index - 7] +
          (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) >>>
        0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index += 1) {
      const first =
        (h +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[index] +
          words[index]) >>>
        0
      const second =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g
      g = f
      f = e
      e = (d + first) >>> 0
      d = c
      c = b
      b = a
      a = (first + second) >>> 0
    }
    hash[0] += a
    hash[1] += b
    hash[2] += c
    hash[3] += d
    hash[4] += e
    hash[5] += f
    hash[6] += g
    hash[7] += h
  }
  const digest = new Uint8Array(32)
  const out = new DataView(digest.buffer)
  hash.forEach((word, index) => out.setUint32(index * 4, word))
  return digest
}

export const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  const block = new Uint8Array(64)
  block.set(key.length > 64 ? sha256(key) : key)
  const inner = new Uint8Array(64 + message.length)
  const outer = new Uint8Array(64 + 32)
  for (let index = 0; index < 64; index += 1) {
    inner[index] = block[index] ^ 0x36
    outer[index] = block[index] ^ 0x5c
  }
  inner.set(message, 64)
  outer.set(sha256(inner), 64)
  return sha256(outer)
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const toBase64Url = (bytes: Uint8Array): string => {
  let text = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
    text += ALPHABET[chunk >> 18] + ALPHABET[(chunk >> 12) & 63]
    if (index + 1 < bytes.length) text += ALPHABET[(chunk >> 6) & 63]
    if (index + 2 < bytes.length) text += ALPHABET[chunk & 63]
  }
  return text
}

const fromBase64Url = (text: string): Uint8Array | undefined => {
  if (!/^[A-Za-z0-9_-]*$/u.test(text) || text.length % 4 === 1) return undefined
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4))
  let written = 0
  for (let index = 0; index < text.length; index += 4) {
    const values = [0, 1, 2, 3].map(step => ALPHABET.indexOf(text[index + step] ?? 'A'))
    const chunk = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3]
    bytes[written++] = chunk >> 16
    if (index + 2 < text.length) bytes[written++] = (chunk >> 8) & 255
    if (index + 3 < text.length) bytes[written++] = chunk & 255
  }
  return bytes
}

const utf8 = new TextEncoder()

// Sixteen bytes of the signature are kept: enough against guessing, and short in an address.
const signature = (secret: string, description: string): string =>
  toBase64Url(hmacSha256(utf8.encode(secret), utf8.encode(`${SHARE_CARD_DESIGN}.${description}`)).slice(0, 16))

/** `<description>.<signature>`: what a card shows, in the shape its address carries. */
export const signShareCard = (content: ShareCardContent, secret: string): string => {
  const description = toBase64Url(utf8.encode(JSON.stringify(content)))
  return `${description}.${signature(secret, description)}`
}

const sameText = (left: string, right: string): boolean => {
  let difference = left.length ^ right.length
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

/** What a signed description says, or nothing when the site did not sign it. */
export const readSignedShareCard = (signed: string, secret: string): ShareCardContent | undefined => {
  const [description, mark, ...rest] = signed.split('.')
  if (!description || !mark || rest.length > 0) return undefined
  if (!sameText(mark, signature(secret, description))) return undefined
  const bytes = fromBase64Url(description)
  if (!bytes) return undefined
  try {
    const content = JSON.parse(new TextDecoder().decode(bytes)) as { kind?: unknown }
    return typeof content.kind === 'string' && SHARE_CARD_KINDS.has(content.kind)
      ? (content as ShareCardContent)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * The secret the site signs with: set on its server, absent from the browser and from a
 * machine that was not given one. Without it a page names the default card, which needs no
 * signature.
 */
export const shareCardSecret = (): string | undefined =>
  typeof process === 'undefined' ? undefined : process.env.SHARE_CARD_SECRET || undefined
