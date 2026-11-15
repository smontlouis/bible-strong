// What never changes on a card, drawn once into an image (ADR-0090). A card is redrawn at every
// frame of its turn; a part that does not move costs the same work each time unless it is kept as
// a picture and laid down in one draw.

import { drawAsImage, Group, Image, type SkImage } from '@shopify/react-native-skia'
import { useEffect, useState, type ReactElement } from 'react'
import { PixelRatio } from 'react-native'

/** The snapshots kept, newest last: a card has two or three. */
const KEPT_SNAPSHOTS = 12
const snapshots = new Map<string, SkImage>()
const pending = new Map<string, Promise<SkImage | null>>()

type Area = { x: number; y: number; width: number; height: number }

const keep = (key: string, image: SkImage) => {
  snapshots.set(key, image)
  while (snapshots.size > KEPT_SNAPSHOTS) {
    const oldest = snapshots.keys().next().value
    if (oldest === undefined) break
    snapshots.delete(oldest)
  }
}

/**
 * Draws `element`, in the card's coordinates, into an image of `area` at the screen's density, so
 * that it lies on the screen pixel for pixel; null until it is ready, then from the cache.
 */
export const useCardSnapshot = (
  key: string | null,
  area: Area,
  element: () => ReactElement
): SkImage | null => {
  const [ready, setReady] = useState<{ key: string; image: SkImage }>()
  useEffect(() => {
    if (!key || snapshots.has(key)) return
    let live = true
    const scale = PixelRatio.get()
    const loading =
      pending.get(key) ??
      drawAsImage(
        <Group transform={[{ scale }, { translateX: -area.x }, { translateY: -area.y }]}>
          {element()}
        </Group>,
        { width: Math.ceil(area.width * scale), height: Math.ceil(area.height * scale) }
      )
        .then(image => {
          if (image) keep(key, image)
          return image
        })
        .catch(() => null)
        .finally(() => pending.delete(key))
    pending.set(key, loading)
    void loading.then(image => {
      if (live && image) setReady({ key, image })
    })
    return () => {
      live = false
    }
    // The key names everything the element draws.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!key) return null
  return snapshots.get(key) ?? (ready?.key === key ? ready.image : null)
}

/** A snapshot laid back where it was drawn, or the live drawing until it is ready. */
export const Snapshot = ({
  image,
  area,
  children,
}: {
  image: SkImage | null
  area: Area
  children: ReactElement
}) =>
  image ? (
    <Image image={image} x={area.x} y={area.y} width={area.width} height={area.height} fit="fill" />
  ) : (
    children
  )
