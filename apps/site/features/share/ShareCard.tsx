import {
  shareCardHasPictures,
  SHARE_CARD_SIZE,
  type ShareCardContent,
} from '@bible-strong/share-card-service/content'
import type { CSSProperties, ReactNode } from 'react'
import { fitShareCardText } from './shareCardFit'
import { SANS, SERIF } from './shareCardFonts'
import { SHARE_MAP_SIZE, shareMapPixel, shareMapWindow } from './shareCardMap'
import { SHARE_CARD_COLORS as COLORS } from './shareCardTokens'

// The share image of a public page, as the design system draws it (`ShareCard…` cards): one
// frame, a head, a body and the lockup. The renderer lays out flex boxes with inline styles
// only, hence no class and no stylesheet here.

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 102 102"><defs><radialGradient id="r" cx="50%" cy="0%" r="100%"><stop offset="0%" stop-color="#000" stop-opacity="0.2"/><stop offset="100%" stop-color="#000" stop-opacity="0.5"/></radialGradient></defs><circle cx="51" cy="51" r="51" fill="#fff"/><circle cx="51" cy="51" r="47.13" fill="none" stroke="url(#r)" stroke-width="7.74"/><circle cx="51" cy="51" r="23.5" fill="BRAND"/></svg>'
const ORNAMENT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760"><circle cx="380" cy="380" r="350" fill="none" stroke="BRAND" stroke-width="58" opacity="0.12"/><circle cx="380" cy="380" r="176" fill="BRAND" opacity="0.12"/></svg>'
const svgUri = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(svg.replaceAll('BRAND', COLORS.brand))}`

// The mark in the top right corner, cut by the edge: pale on every card, itself on the default.
const Corner = ({ svg }: { svg: string }) => (
  <img
    src={svgUri(svg)}
    width={760}
    height={760}
    style={{ position: 'absolute', right: -230, top: -150 }}
  />
)

const Head = ({
  kicker,
  chip,
  narrow = false,
}: {
  kicker?: string
  chip?: string
  /** Beside a picture: a smaller kicker, and the chip under it when they cannot share a line. */
  narrow?: boolean
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: narrow ? 14 : 20,
      ...(narrow ? { maxWidth: TILE.left - PADDING.x - 40 } : {}),
    }}
  >
    {kicker && (
      <div
        style={{
          fontSize: narrow ? 36 : 44,
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

// The ground the atlas draws its cut-out portraits over, as its dark theme draws it: the dusk
// blue they were painted on, which stands out of the light card.
const GROUND = 'radial-gradient(circle at 50% 35%, #4d6a99 0%, #2e466a 55%, #1b2a43 100%)'

const body = (content: Exclude<ShareCardContent, { kind: 'default' | 'entity' }>) => {
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

const Gallery = ({
  pictures,
  cutOut,
}: {
  pictures: { src: string; caption: string }[]
  cutOut?: boolean
}) => (
  <>
    {pictures.slice(0, GALLERY.length).map((picture, index) => {
      const { left, top, rotate } = GALLERY[index]
      return (
        <div
          key={index}
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
          <img
            src={picture.src}
            width={160}
            height={204}
            style={{ ...photoFrame, left: 0, top: 0, ...(cutOut ? { backgroundImage: GROUND } : {}) }}
          />
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

// The picture of an entity, a square standing on the right of the card.
const TILE = {
  left: SHARE_CARD_SIZE.width - PADDING.x - SHARE_MAP_SIZE,
  top: (SHARE_CARD_SIZE.height - SHARE_MAP_SIZE) / 2,
  size: SHARE_MAP_SIZE,
} as const

const tileFrame: CSSProperties = {
  position: 'absolute',
  left: TILE.left,
  top: TILE.top,
  width: TILE.size,
  height: TILE.size,
  display: 'flex',
  overflow: 'hidden',
  borderRadius: 36,
  boxShadow: '0 24px 48px rgba(16, 27, 53, 0.18)',
}

const mapName: CSSProperties = {
  position: 'absolute',
  display: 'flex',
  color: COLORS.ink,
  textShadow: '0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff',
  whiteSpace: 'nowrap',
}

type EntityContent = Extract<ShareCardContent, { kind: 'entity' }>

// A name on one line when it can be, its longest word always: a sans letter is about 0.6 of
// its size wide at this weight.
const entityTitleSize = (title: string, beside: boolean) => {
  const width = beside ? TILE.left - PADDING.x - 40 : 900
  const longest = Math.max(...title.split(/\s+/u).map(word => word.length))
  const fit = (length: number) => Math.floor(width / (length * 0.62))
  return Math.max(56, Math.min(112, Math.max(fit(title.length), Math.min(fit(longest), 72))))
}

const EntityPicture = ({ content, map }: { content: EntityContent; map?: string }) => {
  if (content.map && map) {
    const window = shareMapWindow(content.map.x, content.map.y)
    const self = shareMapPixel(window, content.map.x, content.map.y)
    return (
      <div style={{ ...tileFrame, background: '#d3e0f8' }}>
        <img src={map} width={TILE.size} height={TILE.size} style={{ position: 'absolute', left: 0, top: 0 }} />
        {content.map.neighbours.map(([name, x, y]) => {
          const at = shareMapPixel(window, x, y)
          return (
            <div
              key={name}
              style={{ ...mapName, left: at.left + 10, top: at.top - 13, fontSize: 19, fontWeight: 500 }}
            >
              {name}
            </div>
          )
        })}
        <div
          style={{
            ...mapName,
            left: self.left + 22,
            top: self.top - 18,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {content.title}
        </div>
      </div>
    )
  }
  if (!content.picture) return null
  return (
    <div style={{ ...tileFrame, backgroundImage: GROUND }}>
      <img src={content.picture} width={TILE.size} height={TILE.size} style={{ objectFit: 'cover' }} />
    </div>
  )
}

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

/**
 * The card of a page. `map` is the drawing of the place an entity card shows, which the renderer
 * prepares from the ground of the atlas map: an address cannot carry it.
 */
export const ShareCard = ({ content, map }: { content: ShareCardContent; map?: string }) => {
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

  if (content.kind === 'entity') {
    const beside = Boolean(content.picture || (content.map && map))
    return (
      <div style={frame}>
        {!beside && <Corner svg={ORNAMENT} />}
        <EntityPicture content={content} map={map} />
        <Head kicker={content.kicker} chip={content.chip} narrow={beside} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: beside ? TILE.left - PADDING.x - 40 : 900,
          }}
        >
          <Title size={entityTitleSize(content.title, beside)}>
            {content.title}
          </Title>
          {content.facts && <Facts text={content.facts} />}
          {content.excerpt && <Excerpt text={content.excerpt} lines={3} />}
        </div>
        <Lockup />
      </div>
    )
  }

  const picture = content.kind === 'title' ? content.picture : undefined
  const pictures = content.kind === 'title' ? content.pictures : undefined
  return (
    <div style={frame}>
      <Corner svg={ORNAMENT} />
      {pictures?.length ? (
        <Gallery pictures={pictures} cutOut={content.kind === 'title' && content.cutOut} />
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
