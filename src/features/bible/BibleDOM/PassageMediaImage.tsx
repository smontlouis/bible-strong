import { m, type MotionStyle, type TargetAndTransition, type Transition } from 'framer-motion'
import { useState, type ImgHTMLAttributes, type ReactNode } from 'react'
import { Blurhash } from 'react-blurhash'
import type { ResolvedPassageMedia } from '../passageMedia'

type Props = {
  item: ResolvedPassageMedia
  layoutId: string
  style: MotionStyle
  transition?: Transition
  animate?: TargetAndTransition
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading']
  imageOpacity?: number
  children?: ReactNode
}

const PassageMediaImage = ({
  item,
  layoutId,
  style,
  transition,
  animate,
  loading,
  imageOpacity = 1,
  children,
}: Props) => {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <m.div
      layoutId={layoutId}
      transition={transition}
      animate={animate}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      <Blurhash
        hash={item.blurHash}
        width="100%"
        height="100%"
        resolutionX={32}
        resolutionY={18}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />
      <img
        src={item.thumbnailUrl}
        alt=""
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(false)}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? imageOpacity : 0,
          transition: 'opacity 160ms ease',
        }}
      />
      {children}
    </m.div>
  )
}

export default PassageMediaImage
