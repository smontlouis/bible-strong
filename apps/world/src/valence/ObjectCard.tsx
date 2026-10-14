import { useEffect, useId, useRef, useState } from 'react'
import { Confetti } from '../game-juice'
import { haptic } from '../haptics'
import type { Language } from '../language'
import { Modal } from '../Modal'
import { valenceCopy } from './valence-copy'
import { pioneerObjects, type PioneerObject } from './valence-story'

export const objectImage = (id: string) => `./valence-1876/objects/${id}.webp`

export function ObjectCard({
  object,
  count,
  language,
  onClose,
}: {
  object: PioneerObject
  count: number
  language: Language
  onClose: () => void
}) {
  const t = valenceCopy[language]
  const titleId = useId()
  const close = useRef<HTMLAnchorElement>(null)
  useEffect(() => haptic('star'), [])
  return (
    <Modal className="valence-modal v-object" labelledBy={titleId} closeLabel={t.close} onClose={onClose} initialFocus={close}>
      <p className="v-object-count">
        {t.objectFound} · {count}/{pioneerObjects.length}
      </p>
      <h2 id={titleId}>{object.name[language]}</h2>
      <div className="v-object-halves">
        <section className="v-then">
          <span className="v-year">{t.yesterday}</span>
          <img src={objectImage(object.id)} alt="" width={160} height={160} />
          <p>{object.yesterday[language]}</p>
        </section>
        <section className="v-now">
          <span className="v-year">{t.todayLabel}</span>
          <figure className="v-phone v-phone-small">
            <img src={object.screenshot} alt="" loading="lazy" />
          </figure>
          <p>{object.today[language]}</p>
          <a className="v-cta" ref={close} href={object.url[language]} target="_blank" rel="noreferrer">
            {object.cta[language]}
          </a>
        </section>
      </div>
    </Modal>
  )
}

const TOKENS = {
  canvas: '#f4f7ff',
  surface: '#ffffff',
  ink: '#101b35',
  muted: '#58657a',
  brand: '#5983f0',
  line: 'rgba(16, 27, 53, 0.12)',
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + w, y, x + w, y + h, r)
  context.arcTo(x + w, y + h, x, y + h, r)
  context.arcTo(x, y + h, x, y, r)
  context.arcTo(x, y, x + w, y, r)
  context.closePath()
}

/** 1200 × 630 share card, values from design-system/project/tokens.json. */
export async function renderShareCard(language: Language, name: string, variant: 'visit' | 'link' = 'visit') {
  const t = valenceCopy[language]
  const title = variant === 'link' ? t.title : t.shareTitle
  const subtitle = variant === 'link' ? t.subtitle : t.shareLine
  await Promise.all([
    document.fonts.load('800 60px Pulp'),
    document.fonts.load('500 28px Pulp'),
    document.fonts.load('400 30px ValenceLiterata'),
  ]).catch(() => undefined)
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')!
  context.fillStyle = TOKENS.canvas
  context.fillRect(0, 0, 1200, 630)
  const map = await load('./valence-1876/map/preview.webp')
  context.save()
  roundedRect(context, 40, 40, 560, 550, 20)
  context.clip()
  // The station, the cathedral and the river, cropped from the map.
  context.drawImage(map, 520, 120, 760, 746, 40, 40, 560, 550)
  context.fillStyle = 'rgba(47, 29, 16, 0.12)'
  context.fillRect(40, 40, 560, 550)
  context.restore()
  const objects = await Promise.all(pioneerObjects.map(object => load(objectImage(object.id))))
  objects.forEach((image, index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = 70 + column * 128 + (row ? 64 : 0)
    const y = 330 + row * 120
    context.fillStyle = 'rgba(255, 255, 255, 0.86)'
    context.beginPath()
    context.arc(x + 54, y + 54, 56, 0, Math.PI * 2)
    context.fill()
    context.drawImage(image, x + 6, y + 6, 96, 96)
  })
  context.fillStyle = TOKENS.brand
  context.beginPath()
  context.arc(660, 92, 9, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = TOKENS.muted
  context.font = '500 22px Pulp, Arial, sans-serif'
  context.fillText('BIBLE STRONG · 1876 – 2026', 680, 100)
  context.fillStyle = TOKENS.ink
  context.font = '800 60px Pulp, Arial, sans-serif'
  const words = title.split(' ')
  let line = ''
  let y = 190
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > 480 && line) {
      context.fillText(line, 650, y)
      line = word
      y += 70
    } else line = test
  }
  context.fillText(line, 650, y)
  context.font = '400 28px ValenceLiterata, Georgia, serif'
  context.fillStyle = TOKENS.ink
  const sentence = subtitle.split(' ')
  line = ''
  y += 64
  for (const word of sentence) {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > 480 && line) {
      context.fillText(line, 650, y)
      line = word
      y += 42
    } else line = test
  }
  context.fillText(line, 650, y)
  if (name) {
    context.font = '600 26px Pulp, Arial, sans-serif'
    context.fillStyle = TOKENS.muted
    context.fillText(name, 650, 520)
  }
  context.font = '600 24px Pulp, Arial, sans-serif'
  context.fillStyle = TOKENS.ink
  context.fillText('world.bible-strong.app/valence-1876', 650, 562)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Share card'))), 'image/png')
  )
}

export function ShareCard({ language, name, onClose }: { language: Language; name: string; onClose: () => void }) {
  const t = valenceCopy[language]
  const titleId = useId()
  const [url, setUrl] = useState<string>()
  const [blob, setBlob] = useState<Blob>()
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    let alive = true
    let objectUrl = ''
    void renderShareCard(language, name).then(result => {
      if (!alive) return
      objectUrl = URL.createObjectURL(result)
      setBlob(result)
      setUrl(objectUrl)
    })
    haptic('win')
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [language, name])
  const file = blob ? new File([blob], 'valence-1876.png', { type: 'image/png' }) : null
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }))
  return (
    <Modal className="valence-modal v-share" labelledBy={titleId} closeLabel={t.close} onClose={onClose} initialFocus={primary}>
      <Confetti seed="valence-1876" count={60} />
      <p className="v-object-count">{t.allFound}</p>
      <h2 id={titleId}>{t.shareTitle}</h2>
      <div className="v-share-preview">{url ? <img src={url} alt={t.shareTitle} /> : <span className="v-spinner" />}</div>
      <div className="v-nav">
        {canShare && (
          <button
            type="button"
            className="v-primary"
            ref={primary}
            onClick={() => void navigator.share({ files: [file!], title: t.shareTitle, url: 'https://world.bible-strong.app/valence-1876' }).catch(() => undefined)}
          >
            {t.share}
          </button>
        )}
        {url && (
          <a className={canShare ? 'v-secondary' : 'v-primary'} href={url} download="valence-1876.png">
            {t.download}
          </a>
        )}
      </div>
    </Modal>
  )
}
