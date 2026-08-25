import { m, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { getPassageMediaEmbedUrl, type ResolvedPassageMedia } from '../passageMedia'
import PassageMediaImage from './PassageMediaImage'

type Props = {
  item: ResolvedPassageMedia
  layoutId: string
  layoutTransition: Transition
  borderColor: string
}

const PassageMediaPlayer = ({ item, layoutId, layoutTransition, borderColor }: Props) => {
  const shouldReduceMotion = useReducedMotion()
  const [isReady, setIsReady] = useState(false)
  const readyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (readyTimeout.current) clearTimeout(readyTimeout.current)
    },
    []
  )

  const revealPlayer = () => {
    if (readyTimeout.current) clearTimeout(readyTimeout.current)
    readyTimeout.current = setTimeout(() => setIsReady(true), 220)
  }

  return (
    <m.div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <PassageMediaImage
        item={item}
        layoutId={layoutId}
        transition={{ layout: layoutTransition }}
        imageOpacity={isReady ? 0 : 1}
        style={{
          position: 'relative',
          width: 'min(100vw, 177.7778vh)',
          maxWidth: '100vw',
          maxHeight: '100vh',
          aspectRatio: '16 / 9',
          boxSizing: 'border-box',
          overflow: 'hidden',
          border: `2px solid ${borderColor}`,
          borderRadius: 11,
          boxShadow: '0 7px 22px rgba(0, 0, 0, 0.25)',
          background: 'transparent',
        }}
      >
        <m.iframe
          src={getPassageMediaEmbedUrl(item.providerId)}
          title={item.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
          onLoad={revealPlayer}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 0,
            opacity: isReady ? 1 : 0,
            transition: `opacity ${shouldReduceMotion ? 0 : 0.22}s ease`,
          }}
        />
      </PassageMediaImage>
    </m.div>
  )
}

export default PassageMediaPlayer
