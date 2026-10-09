import { createHash, createHmac } from 'node:crypto'
import type { ShareCardContent } from '@bible-strong/share-card-service/content'
import { describe, expect, it } from 'vitest'
import { hmacSha256, readSignedShareCard, sha256, signShareCard } from './shareCardAddress'

const bytes = (text: string) => new TextEncoder().encode(text)
const hex = (data: Uint8Array) => Buffer.from(data).toString('hex')

describe('Signature of a share card', () => {
  it('hashes as SHA-256 does, across block boundaries', () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const message = bytes('é'.repeat(length))
      expect(hex(sha256(message))).toBe(createHash('sha256').update(message).digest('hex'))
    }
  })

  it('signs as HMAC-SHA-256 does, with a short and a long key', () => {
    for (const key of ['k', 'a secret of ordinary length', 'x'.repeat(200)]) {
      const message = bytes('v1.description')
      expect(hex(hmacSha256(bytes(key), message))).toBe(
        createHmac('sha256', key).update(message).digest('hex')
      )
    }
  })
})

describe('Description carried by the address of a share image', () => {
  const content: ShareCardContent = {
    kind: 'text',
    kicker: 'Jean 3:16',
    chip: 'LSG',
    text: 'Car Dieu a tant aimé le monde qu’il a donné son Fils unique — שָׁלוֹם, ἀγάπη.',
  }

  it('is read back as the site wrote it', () => {
    const signed = signShareCard(content, 'secret')
    expect(signed).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/u)
    expect(readSignedShareCard(signed, 'secret')).toEqual(content)
  })

  it('is read back whatever its length leaves at the end of the encoding', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd']) {
      const card: ShareCardContent = { kind: 'text', kicker: 'k', text }
      expect(readSignedShareCard(signShareCard(card, 'secret'), 'secret')).toEqual(card)
    }
  })

  it('is refused when it was changed, or signed with another secret', () => {
    const signed = signShareCard(content, 'secret')
    const [description, mark] = signed.split('.')
    const other = signShareCard({ ...content, text: 'Un texte que le site n’a jamais écrit.' }, 'x')
    expect(readSignedShareCard(`${other.split('.')[0]}.${mark}`, 'secret')).toBeUndefined()
    const forged = `${mark[0] === 'A' ? 'B' : 'A'}${mark.slice(1)}`
    expect(readSignedShareCard(`${description}.${forged}`, 'secret')).toBeUndefined()
    expect(readSignedShareCard(signed, 'another secret')).toBeUndefined()
    expect(readSignedShareCard(description, 'secret')).toBeUndefined()
    expect(readSignedShareCard(`${signed}.more`, 'secret')).toBeUndefined()
  })

  it('is refused when it describes no kind of card', () => {
    expect(
      readSignedShareCard(signShareCard({ kind: 'poster' } as never, 'secret'), 'secret')
    ).toBeUndefined()
  })
})
