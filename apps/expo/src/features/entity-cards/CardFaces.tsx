import {
  Group,
  Image,
  ImageShader,
  LinearGradient,
  Mask,
  Paint,
  Paragraph,
  RadialGradient,
  Rect,
  RoundedRect,
  rect,
  type SkImage,
  type SkParagraph,
} from '@shopify/react-native-skia'
import { Platform } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import type { EntityCardView } from './cardCatalog'
import { ART_HEIGHT, coverRect, cssLinearEnds, farthestCorner, foilStops } from './cardGeometry'
import type { CardMotion } from './cardMotion'
import { getFoilColors, type CardPalette } from './cardPalettes'
import type { BackParagraphs, FrontParagraphs } from './cardParagraphs'
import { ArtShine, FrameShine, Grain, PREMUL } from './CardFinishes'
import { Snapshot, useCardSnapshot } from './cardSnapshots'
import { getPaperTexture } from './cardTextures'

// The two faces of a card, as `CardFront` and `CardBack` in apps/site/features/atlas/AtlasCards.tsx.

type FaceProps = {
  card: EntityCardView
  palette: CardPalette
  width: number
  height: number
  motion: CardMotion
}

/** The foil gradient over a box, its gleam at the light (`--foil`). */
const Foil = ({
  palette,
  motion,
  box,
}: {
  palette: CardPalette
  motion: CardMotion
  box: { x: number; y: number; width: number; height: number }
}) => {
  const positions = useDerivedValue(() => foilStops(motion.pointerX.get()))
  const ends = cssLinearEnds(100, box.x, box.y, box.width, box.height)
  return (
    <LinearGradient
      start={ends.start}
      end={ends.end}
      colors={getFoilColors(palette)}
      positions={positions}
    />
  )
}

/** Lettering filled with the foil (`background-clip: text`). */
const FoilText = ({
  paragraph,
  x,
  y,
  width,
  palette,
  motion,
  opacity = 1,
}: {
  paragraph: SkParagraph
  x: number
  y: number
  width: number
  palette: CardPalette
  motion: CardMotion
  opacity?: number
}) => {
  const lineWidth = paragraph.getLongestLine()
  const lineHeight = paragraph.getHeight()
  // The box of the lettering itself, where it is aligned in its paragraph.
  const left = paragraph.getLineMetrics()[0]?.left ?? 0
  const box = { x: x + left, y, width: lineWidth, height: lineHeight }
  return (
    <Group layer={<Paint opacity={opacity} />}>
      <Paragraph paragraph={paragraph} x={x} y={y} width={width} />
      <Rect
        x={box.x - lineHeight * 0.2}
        y={box.y}
        width={box.width + lineHeight * 0.4}
        height={box.height}
        blendMode="srcIn"
      >
        <Foil palette={palette} motion={motion} box={box} />
      </Rect>
    </Group>
  )
}

/**
 * Android draws the parts of a card that never move from images made once: there the whole card
 * goes to the GPU from the UI thread at every frame of its turn. iOS keeps drawing them live.
 */
const SNAPSHOTS = Platform.OS === 'android'

/** The frame and its foil, under everything (`.ac-fr-bg`, `.ac-fr-shine`). */
const Frame = ({ card, palette, width, height, motion }: FaceProps) => {
  const area = { x: 0, y: 0, width, height }
  const image = useCardSnapshot(
    SNAPSHOTS ? `frame:${card.id}:${width}:${height}` : null,
    area,
    () => <FrameBase palette={palette} width={width} height={height} />
  )
  return (
    <>
      <Snapshot image={image} area={area}>
        <FrameBase palette={palette} width={width} height={height} />
      </Snapshot>
      <FrameShine finish={card.finish} width={width} height={height} motion={motion} />
    </>
  )
}

/** The frame's colours and grain (`.ac-fr-bg`). */
const FrameBase = ({
  palette,
  width,
  height,
}: {
  palette: CardPalette
  width: number
  height: number
}) => {
  const ends = cssLinearEnds(165, 0, 0, width, height)
  const [sizeX, sizeY] = palette.frameTopSize
  return (
    <>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={ends.start}
          end={ends.end}
          colors={[palette.frameFrom, palette.frameTo]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={{ x: width / 2, y: 0 }}
          r={sizeX * width}
          colors={[palette.frameTop, 'transparent']}
          positions={[0, palette.frameTopStop]}
          transform={[{ scaleY: (sizeY * height) / (sizeX * width) }]}
          origin={{ x: width / 2, y: 0 }}
          flags={PREMUL}
        />
      </Rect>
      <Grain width={width} height={height} />
    </>
  )
}

/** The foil ring inside the edge, and the glare over the whole face (`.ac-ring`, `.ac-glare`). */
const RingAndGlare = ({ palette, width, height, motion }: Omit<FaceProps, 'card'>) => {
  const u = width / 100
  const inset = 2.2 * u + 0.225 * u
  const box = { x: inset, y: inset, width: width - 2 * inset, height: height - 2 * inset }
  const light = useDerivedValue(() => ({
    x: (motion.pointerX.get() / 100) * width,
    y: (motion.pointerY.get() / 100) * height,
  }))
  const radius = useDerivedValue(() => farthestCorner(light.get().x, light.get().y, width, height))
  const glare = useDerivedValue(() => motion.glare.get() * 0.8)
  return (
    <>
      <RoundedRect {...box} r={3 * u - 0.225 * u} style="stroke" strokeWidth={0.45 * u}>
        <Foil palette={palette} motion={motion} box={box} />
      </RoundedRect>
      <Rect x={0} y={0} width={width} height={height} blendMode="overlay" opacity={glare}>
        <RadialGradient
          c={light}
          r={radius}
          colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.65)', 'rgba(0,0,0,0.5)']}
          positions={[0.1, 0.2, 0.9]}
          flags={PREMUL}
        />
      </Rect>
    </>
  )
}

/** The parchment of the sentence, or the night panel of the spiritual beings (`--panel`). */
const Panel = ({
  palette,
  box,
  u,
}: {
  palette: CardPalette
  box: { x: number; y: number; width: number; height: number }
  u: number
}) => {
  const ends = cssLinearEnds(180, box.x, box.y, box.width, box.height)
  return (
    <>
      <RoundedRect {...box} r={2 * u}>
        <LinearGradient
          start={ends.start}
          end={ends.end}
          colors={[palette.panelFrom, palette.panelTo]}
        />
      </RoundedRect>
      {palette.panelTexture === 'paper' ? (
        <RoundedRect {...box} r={2 * u}>
          <ImageShader image={getPaperTexture()} tx="repeat" ty="repeat" />
        </RoundedRect>
      ) : (
        <Group clip={{ rect: rect(box.x, box.y, box.width, box.height), rx: 2 * u, ry: 2 * u }}>
          <Grain {...box} />
        </Group>
      )}
      <RoundedRect
        x={box.x + 0.15 * u}
        y={box.y + 0.15 * u}
        width={box.width - 0.3 * u}
        height={box.height - 0.3 * u}
        r={1.85 * u}
        style="stroke"
        strokeWidth={0.3 * u}
        color="rgba(0,0,0,0.12)"
      />
    </>
  )
}

type Pictures = {
  backdrop: SkImage | null
  subject: SkImage | null
  /** 0 to 1 as each picture arrives. */
  backdropOpacity: SharedValue<number>
  subjectOpacity: SharedValue<number>
}

export const CardFront = ({
  card,
  palette,
  width,
  height,
  motion,
  paragraphs,
  pictures,
}: FaceProps & { paragraphs: FrontParagraphs; pictures: Pictures }) => {
  const u = width / 100
  // The image covers the top of the card; the person stands lower, its head clear of the name.
  const art = { height: ART_HEIGHT * u, subjectTop: 16 * u }
  const { backdrop, subject } = pictures

  // Three depths: the backdrop far behind, the original name halfway, the person in front.
  const plateTransform = useDerivedValue(() =>
    card.scene
      ? [
          { translateX: motion.tx.get() * -1.6 * u },
          { translateY: motion.ty.get() * -1.4 * u },
          { scale: 1.08 },
        ]
      : [
          { translateX: motion.tx.get() * -3.2 * u },
          { translateY: motion.ty.get() * -2.6 * u },
          { scale: 1.12 },
        ]
  )
  const nameTransform = useDerivedValue(() => [
    { translateX: motion.tx.get() * -1.5 * u },
    { translateY: motion.ty.get() * -1.2 * u },
  ])
  const subjectTransform = useDerivedValue(() => [
    { translateX: motion.tx.get() * 2.2 * u },
    { translateY: motion.ty.get() * 1.8 * u },
    { scale: 1.05 },
  ])

  const artBox = { x: 0, y: 0, width, height: art.height }
  const subjectBox = { x: 0, y: art.subjectTop, width, height: art.height }
  const plate = card.scene ? subject : backdrop
  const plateRect = plate ? coverRect(plate.width(), plate.height(), artBox, 0.5, 0.28) : undefined
  const subjectRect =
    !card.scene && subject
      ? coverRect(subject.width(), subject.height(), subjectBox, 0.5, 0.28)
      : undefined

  const panel = { x: 6.5 * u, y: 106.5 * u, width: 87 * u, height: 19 * u }
  const sentenceHeight = paragraphs.sentence.getHeight()
  const sourceHeight = paragraphs.source.getHeight()
  const panelTextTop = panel.y + (panel.height - (sentenceHeight + 0.8 * u + sourceHeight)) / 2
  const footY = height - 6.6 * u - paragraphs.footRight.getHeight()

  const subjectPicture = subjectRect && subject && (
    <Image image={subject} fit="fill" {...subjectRect} opacity={pictures.subjectOpacity} />
  )

  // The lettering that never moves: title, type, sentence and foot, on the parchment.
  const lettering = (
    <>
      <Paragraph paragraph={paragraphs.title} x={7 * u} y={17 * u} width={50 * u} />
      <Paragraph paragraph={paragraphs.typeLine} x={6 * u} y={102.3 * u} width={88 * u} />

      <Panel palette={palette} box={panel} u={u} />
      <Paragraph
        paragraph={paragraphs.sentence}
        x={panel.x + 3.6 * u}
        y={panelTextTop}
        width={panel.width - 7.2 * u}
      />
      <Paragraph
        paragraph={paragraphs.source}
        x={panel.x + 3.6 * u}
        y={panelTextTop + sentenceHeight + 0.8 * u}
        width={panel.width - 7.2 * u}
      />

      <Paragraph paragraph={paragraphs.footLeft} x={7 * u} y={footY} width={62 * u} />
      <Paragraph paragraph={paragraphs.footRight} x={7 * u} y={footY} width={86 * u} />
    </>
  )
  const cardArea = { x: 0, y: 0, width, height }
  const letteringImage = useCardSnapshot(
    SNAPSHOTS ? `lettering:${card.id}:${card.language}:${width}:${height}` : null,
    cardArea,
    () => lettering
  )

  return (
    <>
      <Frame card={card} palette={palette} width={width} height={height} motion={motion} />

      {/* The image, fading into the frame at its foot (`.ac-art`). */}
      <Mask
        mode="alpha"
        mask={
          <Rect {...artBox}>
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: art.height }}
              colors={['#000', '#000', 'transparent']}
              positions={[0, 0.72, 1]}
            />
          </Rect>
        }
      >
        <Group clip={rect(0, 0, width, art.height)}>
          <Rect {...artBox} color={palette.artBg} />
          <Group transform={plateTransform} origin={{ x: width / 2, y: art.height / 2 }}>
            {plate && plateRect && (
              <Image
                image={plate}
                fit="fill"
                {...plateRect}
                opacity={card.scene ? pictures.subjectOpacity : pictures.backdropOpacity}
              />
            )}
          </Group>

          <ArtShine finish={card.finish} width={width} height={art.height} motion={motion} />

          <Group transform={nameTransform}>
            <FoilText
              paragraph={paragraphs.original}
              x={0}
              y={13 * u}
              width={width - 8 * u}
              palette={palette}
              motion={motion}
              opacity={0.55}
            />
          </Group>

          <Group
            transform={subjectTransform}
            origin={{ x: width / 2, y: art.subjectTop + art.height / 2 }}
          >
            {card.fadeTop ? (
              // A portrait the painting cut off at its top fades upward into the shade.
              <Mask
                mode="alpha"
                mask={
                  <Rect {...subjectBox}>
                    <LinearGradient
                      start={{ x: 0, y: subjectBox.y }}
                      end={{ x: 0, y: subjectBox.y + subjectBox.height }}
                      colors={['transparent', 'rgba(0,0,0,0.4)', '#000']}
                      positions={[0, 0.04, 0.11]}
                    />
                  </Rect>
                }
              >
                {subjectPicture}
              </Mask>
            ) : (
              subjectPicture
            )}
          </Group>
        </Group>
      </Mask>

      {/* The shade under the name (`.ac-ribbon`). */}
      <Rect x={0} y={0} width={width} height={40 * u}>
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 40 * u }}
          colors={['rgba(5,8,16,0.92)', 'rgba(5,8,16,0.7)', 'rgba(5,8,16,0)']}
          positions={[0, 0.45, 1]}
        />
      </Rect>

      <FoilText
        paragraph={paragraphs.name}
        x={7 * u}
        y={7 * u}
        width={width}
        palette={palette}
        motion={motion}
      />
      <Snapshot image={letteringImage} area={cardArea}>
        {lettering}
      </Snapshot>

      <RingAndGlare palette={palette} width={width} height={height} motion={motion} />
    </>
  )
}

export const CardBack = ({
  card,
  palette,
  width,
  height,
  motion,
  paragraphs,
}: FaceProps & { paragraphs: BackParagraphs }) => {
  const u = width / 100
  const inner = width - 18 * u
  const left = 9 * u
  const gap = 2.4 * u

  // The column from the top: family, original name, transliteration, Strong, meaning, rule, brief.
  let y = 9 * u
  const placed: { paragraph: SkParagraph; y: number }[] = []
  const place = (paragraph: SkParagraph | null, before = 0) => {
    if (!paragraph) return undefined
    y += before
    const at = y
    placed.push({ paragraph, y: at })
    y += paragraph.getHeight() + gap
    return at
  }
  place(paragraphs.family)
  const originalY = y + 2 * u
  y = originalY + paragraphs.original.getHeight() + gap
  place(paragraphs.transliteration)
  let strongPill: { x: number; y: number; width: number; height: number } | undefined
  if (paragraphs.strong) {
    const textWidth = paragraphs.strong.getMaxIntrinsicWidth()
    const pillWidth = textWidth + 4.8 * u
    const pillHeight = paragraphs.strong.getHeight() + 1.6 * u
    strongPill = { x: (width - pillWidth) / 2, y, width: pillWidth, height: pillHeight }
    y += pillHeight + gap
  }
  place(paragraphs.meaning)
  const ruleY = y + 0.6 * u
  y = ruleY + 0.4 * u + 0.6 * u + gap
  place(paragraphs.brief)

  // The facts stand at the foot of the face.
  const rowGap = 1.3 * u
  const rows = paragraphs.facts.map(fact => ({
    ...fact,
    height: Math.max(fact.term.getHeight() + 0.6 * u, fact.value?.getHeight() ?? 0),
  }))
  const factsHeight =
    rows.reduce((total, row) => total + row.height, 0) + rowGap * (rows.length - 1)
  let factY = height - 8.5 * u - factsHeight

  const rule = { x: (width - 18 * u) / 2, y: ruleY, width: 18 * u, height: 0.4 * u }

  // Rings around the middle of the face, fading out (`.ac-pattern`).
  const patternBox = { x: 2.6 * u, y: 2.6 * u, width: width - 5.2 * u, height: height - 5.2 * u }
  const ringsCenter = {
    x: patternBox.x + patternBox.width / 2,
    y: patternBox.y + patternBox.height * 0.36,
  }
  const ringPeriod = 3.2 * u

  return (
    <>
      <Frame card={card} palette={palette} width={width} height={height} motion={motion} />

      <Group
        layer={<Paint opacity={0.2} />}
        clip={{
          rect: rect(patternBox.x, patternBox.y, patternBox.width, patternBox.height),
          rx: 3 * u,
          ry: 3 * u,
        }}
      >
        <Rect {...patternBox}>
          <RadialGradient
            c={ringsCenter}
            r={ringPeriod}
            colors={[palette.f2, palette.f2, 'transparent', 'transparent']}
            positions={[0, (0.25 * u) / ringPeriod, (0.25 * u) / ringPeriod, 1]}
            mode="repeat"
          />
        </Rect>
        <Rect {...patternBox} blendMode="dstIn">
          <RadialGradient
            c={ringsCenter}
            r={0.7 * patternBox.width}
            colors={['#000', 'transparent']}
            transform={[{ scaleY: (0.55 * patternBox.height) / (0.7 * patternBox.width) }]}
            origin={ringsCenter}
          />
        </Rect>
      </Group>

      {placed.map(({ paragraph, y: at }, index) => (
        <Paragraph key={index} paragraph={paragraph} x={left} y={at} width={inner} />
      ))}
      <FoilText
        paragraph={paragraphs.original}
        x={left}
        y={originalY}
        width={inner}
        palette={palette}
        motion={motion}
      />
      {strongPill && paragraphs.strong && (
        <>
          <RoundedRect
            {...strongPill}
            r={strongPill.height / 2}
            style="stroke"
            strokeWidth={0.25 * u}
            color={palette.typeInk}
          />
          <Paragraph
            paragraph={paragraphs.strong}
            x={strongPill.x + 2.4 * u}
            y={strongPill.y + 0.8 * u}
            width={strongPill.width}
          />
        </>
      )}
      <RoundedRect {...rule} r={u}>
        <Foil palette={palette} motion={motion} box={rule} />
      </RoundedRect>

      {rows.map((row, index) => {
        const at = factY
        factY += row.height + rowGap
        return (
          <Group key={index}>
            <Paragraph paragraph={row.term} x={left} y={at + 0.6 * u} width={inner} />
            {row.value && (
              <Paragraph
                paragraph={row.value}
                x={left + paragraphs.termWidth + 3 * u}
                y={at}
                width={inner - paragraphs.termWidth - 3 * u}
              />
            )}
          </Group>
        )
      })}

      <RingAndGlare palette={palette} width={width} height={height} motion={motion} />
    </>
  )
}
