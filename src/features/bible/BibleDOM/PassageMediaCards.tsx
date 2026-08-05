import type { CSSProperties } from 'react'
import type { ResolvedPassageMedia } from '../passageMedia'
import type { RootStyles } from './BibleDOMWrapper'
import { OPEN_PASSAGE_MEDIA } from './dispatch'
import { useDispatch } from './DispatchProvider'
import { useTranslations } from './TranslationsContext'

type Props = RootStyles & {
  items: ResolvedPassageMedia[]
  title?: string
  placement: 'introduction' | 'inline' | 'chapter-resources'
}

const formatDuration = (durationSeconds: number) => {
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = Math.max(0, durationSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const PassageMediaCards = ({ items, title, placement, settings }: Props) => {
  const dispatch = useDispatch()
  const translations = useTranslations()
  if (!items.length) return null

  const colors = settings.colors[settings.theme]
  const isInline = placement === 'inline'
  const sectionStyle: CSSProperties = {
    direction: 'ltr',
    width: '100%',
    margin: isInline ? '22px 0 28px' : placement === 'introduction' ? '8px 0 30px' : '44px 0 0',
    paddingTop: placement === 'chapter-resources' ? 28 : 0,
    borderTop: placement === 'chapter-resources' ? `1px solid ${colors.border}` : undefined,
    fontFamily: settings.fontFamily,
    textAlign: 'left',
  }

  return (
    <section data-ignore-verse-touch style={sectionStyle} aria-label={title}>
      {title && (
        <h2
          style={{
            margin: '0 0 14px',
            color: colors.default,
            fontFamily: settings.fontFamily,
            fontSize: isInline ? 17 : 22,
            lineHeight: 1.25,
            fontWeight: 700,
          }}
        >
          {title}
        </h2>
      )}
      <div style={{ display: 'grid', gap: 14 }}>
        {items.map(item => (
          <button
            key={item.editionId}
            type="button"
            data-ignore-verse-touch
            aria-label={translations.passageMediaOpen.replace('{{title}}', item.title)}
            onClick={() => {
              void dispatch({ type: OPEN_PASSAGE_MEDIA, payload: item.sourceUrl })
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: isInline ? '116px minmax(0, 1fr)' : 'minmax(0, 1fr)',
              width: '100%',
              overflow: 'hidden',
              margin: 0,
              padding: 0,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              background: colors.reverse,
              color: colors.default,
              fontFamily: settings.fontFamily,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                position: 'relative',
                display: 'block',
                aspectRatio: '16 / 9',
                overflow: 'hidden',
                background: colors.lightGrey,
              }}
            >
              <img
                src={item.thumbnailUrl}
                alt=""
                loading="lazy"
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  display: 'grid',
                  width: isInline ? 34 : 46,
                  height: isInline ? 34 : 46,
                  placeItems: 'center',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.72)',
                  color: '#fff',
                  fontSize: isInline ? 15 : 19,
                  lineHeight: 1,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                ▶
              </span>
              <span
                style={{
                  position: 'absolute',
                  right: 6,
                  bottom: 6,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'rgba(0, 0, 0, 0.78)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {formatDuration(item.durationSeconds)}
              </span>
            </span>
            <span style={{ display: 'block', minWidth: 0, padding: isInline ? '10px 12px' : 14 }}>
              <strong
                style={{
                  display: 'block',
                  color: colors.default,
                  fontFamily: settings.fontFamily,
                  fontSize: isInline ? 14 : 16,
                  lineHeight: 1.3,
                }}
              >
                {item.title}
              </strong>
              <span
                style={{
                  display: 'block',
                  marginTop: 5,
                  color: colors.tertiary,
                  fontFamily: settings.fontFamily,
                  fontSize: 12,
                  lineHeight: 1.25,
                }}
              >
                {item.attributionLabel}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default PassageMediaCards
