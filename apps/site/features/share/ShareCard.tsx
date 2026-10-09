import type { CSSProperties, ReactNode } from 'react'
import { SANS, SERIF } from './shareCardFonts'
import { fitShareCardText } from './shareCardText'
import { SHARE_CARD_COLORS as COLORS, SHARE_CARD_SIZE } from './shareCardTokens'

/**
 * The share image of a public page, as the design system draws it (`ShareCard…` cards): one
 * frame, a head, a body and the lockup. The renderer lays out flex boxes with inline styles
 * only, hence no class and no stylesheet here.
 */
export type ShareCardContent =
  | { kind: 'default'; language?: 'fr' | 'en' }
  | { kind: 'text'; kicker: string; chip?: string; text: string }
  | {
      kind: 'word'
      kicker: string
      chip: string
      original: string
      transliteration: string
      gloss: string
      facts?: string
    }
  | {
      kind: 'title'
      kicker?: string
      chip?: string
      title: string
      /** A chapter is named in very large type; a longer name steps down by itself. */
      large?: boolean
      /** One line of facts under the title. */
      facts?: string
      /** The first lines of what the page reads. */
      excerpt?: string
      /** A picture the renderer can read: JPEG or PNG, not WebP. */
      picture?: string
      /** Six captioned pictures, in two rows of three, in the place of the single one. */
      pictures?: { src: string; caption: string }[]
    }

/** A card that shows photographs is heavier and is delivered as a JPEG. */
export const shareCardHasPictures = (content: ShareCardContent): boolean =>
  content.kind === 'title' && Boolean(content.picture || content.pictures?.length)

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 102 102"><defs><radialGradient id="r" cx="50%" cy="0%" r="100%"><stop offset="0%" stop-color="#000" stop-opacity="0.2"/><stop offset="100%" stop-color="#000" stop-opacity="0.5"/></radialGradient></defs><circle cx="51" cy="51" r="51" fill="#fff"/><circle cx="51" cy="51" r="47.13" fill="none" stroke="url(#r)" stroke-width="7.74"/><circle cx="51" cy="51" r="23.5" fill="BRAND"/></svg>'
const ORNAMENT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760"><circle cx="380" cy="380" r="350" fill="none" stroke="BRAND" stroke-width="58" opacity="0.12"/><circle cx="380" cy="380" r="176" fill="BRAND" opacity="0.12"/></svg>'
const svgUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg.replaceAll('BRAND', COLORS.brand)).toString('base64')}`

// The mark in the top right corner, cut by the edge: pale on every card, itself on the default.
const Corner = ({ svg }: { svg: string }) => (
  <img
    src={svgUri(svg)}
    width={760}
    height={760}
    style={{ position: 'absolute', right: -230, top: -150 }}
  />
)

const Head = ({ kicker, chip }: { kicker?: string; chip?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
    {kicker && (
      <div
        style={{
          fontSize: 44,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: COLORS.accent,
        }}
      >
        {kicker}
      </div>
    )}
    {chip && (
      <div
        style={{
          padding: '6px 16px',
          borderRadius: 999,
          background: COLORS.accentSoft,
          color: COLORS.accentInk,
          fontSize: 22,
          lineHeight: '30px',
          fontWeight: 600,
        }}
      >
        {chip}
      </div>
    )}
  </div>
)

const Lockup = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 600 }}>
    <img src={svgUri(MARK)} width={44} height={44} />
    Bible Strong
  </div>
)

const clamped = (lines: number): CSSProperties => ({
  display: 'block',
  lineClamp: lines,
  overflow: 'hidden',
})

// A line of facts may name an original word, which the sans face cannot write.
const Facts = ({ text }: { text: string }) => (
  <div style={{ fontFamily: `${SANS}, ${SERIF}`, fontSize: 28, fontWeight: 500, color: COLORS.muted }}>
    {text}
  </div>
)

const Excerpt = ({ text, lines }: { text: string; lines: number }) => (
  <div style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.4, ...clamped(lines) }}>{text}</div>
)

const Title = ({ children, size }: { children: ReactNode; size: number }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      fontSize: size,
      lineHeight: size >= 112 ? 1 : 1.04,
      fontWeight: 800,
      letterSpacing: '-0.025em',
    }}
  >
    {children}
  </div>
)

const body = (content: Exclude<ShareCardContent, { kind: 'default' }>) => {
  if (content.kind === 'text') {
    const fit = fitShareCardText(content.text)
    return (
      <div
        style={{
          fontFamily: SERIF,
          fontSize: fit.fontSize,
          lineHeight: 1.32,
          ...clamped(fit.lines),
        }}
      >
        {content.text}
      </div>
    )
  }
  if (content.kind === 'word') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28 }}>
          <div style={{ fontFamily: SERIF, fontSize: 132, lineHeight: 1.15 }}>{content.original}</div>
          <div style={{ fontSize: 44, fontWeight: 500, color: COLORS.muted }}>
            {content.transliteration}
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1.2 }}>{content.gloss}</div>
        {content.facts && <Facts text={content.facts} />}
      </div>
    )
  }
  const beside = shareCardHasPictures(content)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Title size={content.title.length > 14 ? 84 : content.large ? 160 : 120}>{content.title}</Title>
      {content.facts && <Facts text={content.facts} />}
      {content.excerpt && <Excerpt text={content.excerpt} lines={beside ? 3 : 2} />}
    </div>
  )
}

// Two rows of three, each picture slightly turned, as the design system draws them.
const GALLERY = [
  { left: 620, top: 62, rotate: -3 },
  { left: 812, top: 50, rotate: 2 },
  { left: 1004, top: 64, rotate: -2 },
  { left: 624, top: 308, rotate: 2 },
  { left: 816, top: 296, rotate: -2 },
  { left: 1008, top: 310, rotate: 3 },
] as const

const photoFrame: CSSProperties = {
  position: 'absolute',
  objectFit: 'cover',
  border: `8px solid ${COLORS.surface}`,
  borderRadius: 20,
}

const Gallery = ({ pictures }: { pictures: { src: string; caption: string }[] }) => (
  <>
    {pictures.slice(0, GALLERY.length).map((picture, index) => {
      const { left, top, rotate } = GALLERY[index]
      return (
        <div
          key={picture.src}
          style={{
            position: 'absolute',
            left,
            top,
            width: 176,
            height: 220,
            display: 'flex',
            transform: `rotate(${rotate}deg)`,
          }}
        >
          <img src={picture.src} width={160} height={204} style={{ ...photoFrame, left: 0, top: 0 }} />
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              padding: '2px 10px',
              borderRadius: 999,
              background: COLORS.surface,
              fontSize: 15,
              lineHeight: '22px',
              fontWeight: 600,
            }}
          >
            {picture.caption}
          </div>
        </div>
      )
    })}
  </>
)

const PADDING = { x: 72, y: 64 } as const

// The renderer adds the padding to the width and the height it is given.
// The headline of the home page, on two lines.
const TAGLINE = {
  fr: ['Un verset.', 'Une étude entière.'],
  en: ['One verse.', 'A complete study.'],
} as const

const frame: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  width: SHARE_CARD_SIZE.width - 2 * PADDING.x,
  height: SHARE_CARD_SIZE.height - 2 * PADDING.y,
  padding: `${PADDING.y}px ${PADDING.x}px`,
  background: COLORS.canvas,
  color: COLORS.ink,
  fontFamily: SANS,
}

export const ShareCard = ({ content }: { content: ShareCardContent }) => {
  if (content.kind === 'default') {
    return (
      <div style={frame}>
        <Corner svg={MARK} />
        <div style={{ display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Title size={112}>
            <span>Bible</span>
            <span>Strong</span>
          </Title>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 44,
              lineHeight: 1.18,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            <span>{TAGLINE[content.language ?? 'fr'][0]}</span>
            <span>{TAGLINE[content.language ?? 'fr'][1]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 600 }}>bible-strong.app</div>
      </div>
    )
  }

  const picture = content.kind === 'title' ? content.picture : undefined
  const pictures = content.kind === 'title' ? content.pictures : undefined
  return (
    <div style={frame}>
      <Corner svg={ORNAMENT} />
      {pictures?.length ? (
        <Gallery pictures={pictures} />
      ) : (
        picture && (
          <img
            src={picture}
            width={468}
            height={356}
            style={{ ...photoFrame, left: 656, top: 118, transform: 'rotate(2deg)' }}
          />
        )
      )}
      <Head kicker={content.kicker} chip={content.chip} />
      <div style={{ display: 'flex', maxWidth: shareCardHasPictures(content) ? 540 : 900 }}>
        {body(content)}
      </div>
      <Lockup />
    </div>
  )
}
