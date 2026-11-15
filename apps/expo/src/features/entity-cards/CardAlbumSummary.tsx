import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { backgroundImage } from '~common/ui/backgroundImage'
import { HStack, VStack } from '~common/ui/Box'
import { radii } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import { useEntityPortraitGround } from '~features/lexique/useEntityPortraitGround'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

import type { EntityCardView } from './cardCatalog'
import type { CardAlbum } from './cardCollection'
import { CardFan } from './CardFan'

const GOLD = '#f2c14e'

/** A share of the collection, as a thin gold bar on the page's border colour. */
const Gauge = ({ found, total, height }: { found: number; total: number; height: number }) => {
  const theme = useTheme()
  const share = total ? found / total : 0
  return (
    <View
      style={{
        height,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: `${Math.max(share * 100, found ? 2 : 0)}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: GOLD,
        }}
      />
    </View>
  )
}

/** One kind of card, its count over a small gauge. */
const Part = ({ label, found, total }: { label: string; found: number; total: number }) => (
  <VStack className="flex-1 gap-[5px]">
    <HStack className="items-baseline justify-between gap-[6px]">
      <Text className="text-[12px] text-grey" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-[12px] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {found} / {total}
      </Text>
    </HStack>
    <Gauge found={found} total={total} height={4} />
  </VStack>
)

/**
 * The head of the album (ADR-0090): the last cards found in a fan, as the home shows them, how
 * many the reader holds, and the characters and the life stages each on its own gauge. It stands
 * on the clay ground of the cards still to find.
 */
export const CardAlbumSummary = ({
  album,
  latest,
}: {
  album: CardAlbum
  latest: EntityCardView[]
}) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const ground = useEntityPortraitGround()
  return (
    <VStack
      className="gap-[16px] p-[18px]"
      style={{
        borderRadius: radii.card,
        borderCurve: 'continuous',
        ...backgroundImage(ground),
        backgroundColor: theme.colors.lightGrey,
      }}
    >
      <HStack className="items-center gap-[18px]">
        <CardFan cards={latest} cardWidth={50} />
        <VStack className="flex-1 min-w-0 gap-[8px]">
          <VStack>
            <Text
              className="text-[40px] leading-[46px]"
              style={[titleFontStyle(theme), { fontVariant: ['tabular-nums'] }]}
            >
              {album.found}
            </Text>
            <Text className="text-[14px] text-grey">
              {t('collection.ofTotal', { total: album.total })}
            </Text>
          </VStack>
          <Gauge found={album.found} total={album.total} height={8} />
        </VStack>
      </HStack>
      <HStack className="gap-[16px]">
        <Part
          label={t('collection.charactersLabel')}
          found={album.characters.found}
          total={album.characters.total}
        />
        <Part
          label={t('collection.stagesLabel')}
          found={album.stages.found}
          total={album.stages.total}
        />
      </HStack>
    </VStack>
  )
}
