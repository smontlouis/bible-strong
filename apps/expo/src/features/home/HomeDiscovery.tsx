import { useFonts } from 'expo-font'
import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import ResourceIcon from '~common/icons/ResourceIcon'
import Card from '~common/ui/Card'
import NaveOfTheDay from './NaveOfTheDay'
import { DiscoveryCardContext } from './ResourceDiscoveryEntry'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import { HomeGrid, useHomeLayout } from './homeLayout'
import { WidgetLoadingHeightContext, WidgetWidthContext } from './widget'

/** Height of the content of a compact card: the card's 76 points less its padding. */
const COMPACT_CONTENT_HEIGHT = 52

/**
 * Random Greek, Hebrew, Nave and dictionary entries on the home. They are drawn at random, not
 * per day, so each card carries its own shuffle button. A phone scrolls tall cards; a wider home
 * lays them out two by two as low cards, the word and its gloss on two lines beside the mark.
 */
const HomeDiscovery = () => {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const { t } = useTranslation()
  const { wide } = useHomeLayout()
  const cards = [
    { id: 'greek', kind: 'strong' as const, entry: <StrongOfTheDay type="grec" /> },
    { id: 'hebrew', kind: 'strong' as const, entry: <StrongOfTheDay type="hebreu" /> },
    { id: 'nave', kind: 'nave' as const, entry: <NaveOfTheDay /> },
    { id: 'dictionary', kind: 'dictionary' as const, entry: <WordOfTheDay /> },
  ]

  const items = cards.map(card => (
    <DiscoveryCardContext.Provider
      key={card.id}
      value={{ icon: <ResourceIcon kind={card.kind} size={wide ? 26 : 20} />, compact: wide }}
    >
      <Card
        className={
          wide
            ? 'w-full min-h-[76px] py-[12px] pl-[14px] pr-[12px]'
            : 'w-[220px] h-[148px] p-[14px]'
        }
      >
        {card.entry}
      </Card>
    </DiscoveryCardContext.Provider>
  ))

  return (
    <WidgetWidthContext.Provider value="100%">
      <WidgetLoadingHeightContext.Provider value={wide ? COMPACT_CONTENT_HEIGHT : undefined}>
        {wide ? (
          <HomeGrid columns={2}>{items}</HomeGrid>
        ) : (
          <HorizontalControlScrollView
            horizontal
            accessibilityLabel={t('home.discovery.subtitle')}
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {items}
          </HorizontalControlScrollView>
        )}
      </WidgetLoadingHeightContext.Provider>
    </WidgetWidthContext.Provider>
  )
}

export default HomeDiscovery
