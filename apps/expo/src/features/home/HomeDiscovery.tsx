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
import { WidgetWidthContext } from './widget'

/** Content width from which the four cards share a single row, like the Explorer cards. */
const SINGLE_ROW_CONTENT = 720

/**
 * Random Greek, Hebrew, Nave and dictionary entries on the home. They are drawn at random, not
 * per day, so each card carries its own shuffle button. A phone scrolls them; a wide home lays
 * them out as a grid.
 */
const HomeDiscovery = () => {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const { t } = useTranslation()
  const { content, wide } = useHomeLayout()
  const cards = [
    { id: 'greek', kind: 'strong' as const, entry: <StrongOfTheDay type="grec" /> },
    { id: 'hebrew', kind: 'strong' as const, entry: <StrongOfTheDay type="hebreu" /> },
    { id: 'nave', kind: 'nave' as const, entry: <NaveOfTheDay /> },
    { id: 'dictionary', kind: 'dictionary' as const, entry: <WordOfTheDay /> },
  ]

  const items = cards.map(card => (
    <DiscoveryCardContext.Provider
      key={card.id}
      value={{ icon: <ResourceIcon kind={card.kind} size={20} /> }}
    >
      <Card className={`${wide ? 'w-full' : 'w-[220px]'} h-[148px] p-[14px]`}>{card.entry}</Card>
    </DiscoveryCardContext.Provider>
  ))

  return (
    <WidgetWidthContext.Provider value="100%">
      {wide ? (
        <HomeGrid columns={content >= SINGLE_ROW_CONTENT ? 4 : 2}>{items}</HomeGrid>
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
    </WidgetWidthContext.Provider>
  )
}

export default HomeDiscovery
