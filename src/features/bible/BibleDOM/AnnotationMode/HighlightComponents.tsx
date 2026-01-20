'use dom'

import Color from 'color'
import { styled, keyframes } from 'goober'

// Animation de 0 à 100% de largeur avec clip-path (performant, GPU accelerated)
const expandWidth = keyframes`
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
`

export type AnnotationType = 'background' | 'underline' | 'circle'

// Generate a consistent pseudo-random delay (0-0.5s) based on a string id
export const getAnimationDelay = (id: string): number =>
  (id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 50) / 100

export interface HighlightRect {
  id: string
  top: number
  left: number
  width: number
  height: number
  color: string
  type: 'selection' | 'annotation'
  annotationType?: AnnotationType
  annotationId?: string
}

// Create marker/highlighter gradient effect
// intensity: 1.0 = normal, >1.0 = plus intense (max opacity capped at 1)
function createMarkerGradient(colorStr: string, intensity: number = 1): string {
  try {
    const c = Color(colorStr)
    const [r, g, b] = c.rgb().array()

    // Helper to apply intensity with max cap at 1
    const o = (opacity: number) => Math.min(1, opacity * intensity)

    return `linear-gradient(104deg, rgba(${r}, ${g}, ${b}, 0) 0.9%, rgba(${r}, ${g}, ${b}, ${o(1)}) 2.4%, rgba(${r}, ${g}, ${b}, ${o(0.5)}) 5.8%, rgba(${r}, ${g}, ${b}, ${o(0.3)}) 93%, rgba(${r}, ${g}, ${b}, ${o(0.7)}) 96%, rgba(${r}, ${g}, ${b}, 0) 98%), linear-gradient(183deg, rgba(${r}, ${g}, ${b}, 0) 0%, rgba(${r}, ${g}, ${b}, ${o(0.3)}) 7.9%, rgba(${r}, ${g}, ${b}, 0) 15%)`
  } catch {
    return colorStr // Fallback to solid color
  }
}

export const HighlightLayer = styled('div')<{ $dimmed?: boolean }>(({ $dimmed }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  opacity: $dimmed ? 0.3 : 1,
  transition: 'opacity 0.3s ease',
}))

export const HighlightRectDiv = styled('div')<{
  $top: number
  $left: number
  $width: number
  $height: number
  $color: string
  $annotationType?: AnnotationType
  $isSelected?: boolean
  $primaryColor?: string
  $backgroundColor?: string
  $animationDelay?: number
}>(({
  $top,
  $left,
  $width,
  $height,
  $color,
  $annotationType,
  $isSelected,
  $primaryColor,
  $backgroundColor,
  $animationDelay = 0,
}) => {
  const isAnnotationBackground = $annotationType === 'background'
  const isUnderline = $annotationType === 'underline'
  const isCircle = $annotationType === 'circle'
  const isSelection = !$annotationType

  const getBackground = () => {
    if (isAnnotationBackground) return createMarkerGradient($color)
    if (isUnderline) return createMarkerGradient($color, 2)
    if (isCircle) return 'transparent'
    if (isSelection) return $color
    return 'transparent'
  }

  return {
    position: 'absolute',
    top: `${$top}px`,
    left: `${$left}px`,
    width: `${$width}px`,
    height: `${$height}px`,
    borderRadius: '2px',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    transition: 'background 0.1s ease, box-shadow 0.1s ease',

    boxShadow: $isSelected
      ? `${$backgroundColor} 0px 0px 0px 2px, ${$primaryColor} 0px 0px 0px 4px`
      : 'none',

    // Background pour la sélection (pas d'animation)
    ...(isSelection && {
      background: $color,
    }),

    // Pseudo-élément pour le background des annotations (avec animation clip-path)
    ...($annotationType &&
      !isCircle && {
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '2px',
          transition: 'background 0.3s ease',
          background: getBackground(),

          // Underline: gradient positioned at bottom with smaller height
          ...(isUnderline && {
            backgroundSize: '100% 6px',
            backgroundPosition: 'bottom',
            backgroundRepeat: 'no-repeat',
          }),

          // Animation de gauche à droite avec délai aléatoire
          animation: `${expandWidth} 0.4s ease-out ${$animationDelay}s both`,
        },
      }),

    // Circle: effet de cercle dessiné à la main (sketchy) - Snippflow style
    ...(isCircle &&
      (() => {
        // Create soft color variations using Color library
        const c = Color($color)
        const [r, g, b] = c.rgb().array()
        const softBorder = `rgba(${r}, ${g}, ${b}, 0.6)`
        const thinBorder = `rgba(${r}, ${g}, ${b}, 0.4)`
        const glowColor = `rgba(${r}, ${g}, ${b}, 0.15)`

        // Dynamic sizing: cap overflow at max pixels instead of fixed percentage
        const maxOverflowX = 20 // max horizontal overflow in pixels per side
        const maxOverflowY = 8 // max vertical overflow in pixels per side
        const percentOverflowX = $width * 0.1 // 10% per side = 120% total
        const percentOverflowY = $height * 0.1

        const overflowX = Math.min(percentOverflowX, maxOverflowX)
        const overflowY = Math.min(percentOverflowY, maxOverflowY)

        const widthPercent = (($width + overflowX * 2) / $width) * 100
        const heightPercent = (($height + overflowY * 2) / $height) * 100
        const offsetX = (widthPercent - 100) / 2
        const offsetY = (heightPercent - 100) / 2

        // Dynamic rotation: reduce for longer content
        const getRotation = (width: number) => {
          if (width > 150) return 1
          if (width > 100) return 2
          if (width > 75) return 3
          if (width > 50) return 7
          return 10
        }
        const rotation = getRotation($width)

        return {
          zIndex: 1,
          borderRadius: '4px',
          '&::before, &::after': {
            content: '""',
            width: `${widthPercent}%`,
            height: `${heightPercent}%`,
            position: 'absolute',
            top: `-${offsetY}%`,
            left: `-${offsetX}%`,
            zIndex: -1,
            borderRadius: '100%',
            boxSizing: 'border-box',
            // Soft glow effect
            boxShadow: `0 0 8px ${glowColor}, inset 0 0 4px ${glowColor}`,
          },
          '&::before': {
            border: `3px solid ${softBorder}`,
            transform: `rotate(-${rotation}deg)`,
          },
          '&::after': {
            border: `1px solid ${thinBorder}`,
            transform: `rotate(${rotation}deg)`,
          },
        }
      })()),
  }
})

export const SelectionHandle = styled('div')<{
  $top: number
  $left: number
  $position: 'start' | 'end'
}>(({ $top, $left, $position }) => ({
  position: 'absolute',
  top: `${$top}px`,
  left: `${$left}px`,
  width: '14px',
  height: '14px',
  borderRadius: '50%',
  backgroundColor: 'rgba(0, 122, 255, 1)',
  transform: $position === 'start' ? 'translate(-50%, -100%)' : 'translate(-50%, 0%)',
  zIndex: 20,
  pointerEvents: 'auto',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  // Stem/caret line
  '&::after': {
    content: '""',
    position: 'absolute',
    left: '50%',
    width: '2px',
    height: '8px',
    backgroundColor: 'rgba(0, 122, 255, 1)',
    transform: 'translateX(-50%)',
    ...($position === 'start' ? { bottom: '-8px' } : { top: '-8px' }),
  },
}))
