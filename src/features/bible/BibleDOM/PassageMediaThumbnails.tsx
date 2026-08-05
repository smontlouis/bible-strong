import type { CSSProperties } from 'react'
import type { ResolvedPassageMedia } from '../passageMedia'
import type { RootStyles } from './BibleDOMWrapper'
import { scaleFontSize } from './scaleFontSize'

type Props = RootStyles & {
  items: ResolvedPassageMedia[]
  placement: 'introduction' | 'inline' | 'chapter-resources'
  isParallel?: boolean
}

const getStackTransform = (index: number, count: number) => {
  if (count <= 1) return 'none'

  const position = (index / (count - 1)) * 2 - 1
  return `translateX(${position * 3}px) rotate(${position * 5}deg)`
}

const PassageMediaThumbnails = ({ items, placement, settings, isParallel }: Props) => {
  if (!items.length) return null

  const isInline = placement === 'inline'
  const height = isInline ? scaleFontSize(isParallel ? 22 : 29, settings.fontSizeScale) : '76px'
  const width = isInline ? scaleFontSize(isParallel ? 39 : 52, settings.fontSizeScale) : '135px'
  const colors = settings.colors[settings.theme]
  const stackStyle: CSSProperties = {
    position: 'relative',
    display: isInline ? 'inline-grid' : 'grid',
    width,
    height,
    margin: isInline ? '0 7px' : placement === 'introduction' ? '10px auto 28px' : '42px auto 0',
    verticalAlign: isInline ? 'middle' : undefined,
    direction: 'ltr',
    isolation: 'isolate',
  }

  return (
    <span data-ignore-verse-touch style={stackStyle}>
      {items.map((item, index) => (
        <img
          key={item.editionId}
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          style={{
            gridArea: '1 / 1',
            display: 'block',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            objectFit: 'cover',
            border: `2px solid ${colors.reverse}`,
            borderRadius: isInline ? 5 : 9,
            boxShadow: '0 2px 7px rgba(0, 0, 0, 0.22)',
            transform: getStackTransform(index, items.length),
            transformOrigin: 'center',
            zIndex: index + 1,
          }}
        />
      ))}
    </span>
  )
}

export default PassageMediaThumbnails
