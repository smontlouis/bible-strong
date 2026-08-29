import { m, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { getPassageMediaEmbedUrl, type ResolvedPassageMedia } from '../passageMedia'
import { OPEN_PASSAGE_MEDIA_SOURCE } from './dispatch'
import { useDispatch } from './DispatchProvider'
import PassageMediaImage from './PassageMediaImage'
import { useTranslations } from './TranslationsContext'

type Props = {
  item: ResolvedPassageMedia
  layoutId: string
  layoutTransition: Transition
  borderColor: string
  buttonColor: string
  buttonBackgroundColor: string
}

const PassageMediaPlayer = ({
  item,
  layoutId,
  layoutTransition,
  borderColor,
  buttonColor,
  buttonBackgroundColor,
}: Props) => {
  const shouldReduceMotion = useReducedMotion()
  const dispatch = useDispatch()
  const translations = useTranslations()
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
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        padding: '58px 10px 18px',
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
          width: 'min(calc(100vw - 20px), calc(177.7778vh - 153px))',
          maxWidth: '100vw',
          maxHeight: 'calc(100vh - 86px)',
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
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
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
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          void dispatch({ type: OPEN_PASSAGE_MEDIA_SOURCE, payload: item.sourceUrl })
        }}
        style={{
          appearance: 'none',
          border: `1px solid ${borderColor}`,
          borderRadius: 999,
          padding: '7px 12px',
          background: buttonBackgroundColor,
          color: buttonColor,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: 12,
          lineHeight: 1.2,
          fontWeight: 650,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {translations.passageMediaOpenInYoutube}
      </button>
    </m.div>
  )
}

export default PassageMediaPlayer
