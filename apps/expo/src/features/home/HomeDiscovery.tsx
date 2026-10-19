import { useFonts } from 'expo-font'
import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import ResourceIcon from '~common/icons/ResourceIcon'
import Box from '~common/ui/Box'
import NaveOfTheDay from './NaveOfTheDay'
import { DiscoveryCardContext } from './ResourceDiscoveryEntry'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import { WidgetWidthContext } from './widget'

/**
 * Random Greek, Hebrew, Nave and dictionary entries on the compact home. They are drawn at
 * random, not per day, so each card carries its own shuffle button.
 */
const HomeDiscovery = () => {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const { t } = useTranslation()
  const cards = [
    { id: 'greek', kind: 'strong' as const, entry: <StrongOfTheDay type="grec" discovery /> },
    { id: 'hebrew', kind: 'strong' as const, entry: <StrongOfTheDay type="hebreu" discovery /> },
    { id: 'nave', kind: 'nave' as const, entry: <NaveOfTheDay discovery /> },
    { id: 'dictionary', kind: 'dictionary' as const, entry: <WordOfTheDay discovery /> },
  ]

  return (
    <WidgetWidthContext.Provider value="100%">
      <HorizontalControlScrollView
        horizontal
        accessibilityLabel={t('home.discovery.subtitle')}
        showsHorizontalScrollIndicator={false}
        style={{ overflow: 'visible' }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 12 }}
      >
        {cards.map(card => (
          <DiscoveryCardContext.Provider
            key={card.id}
            value={{ icon: <ResourceIcon kind={card.kind} size={20} /> }}
          >
            <Box className="w-[220px] h-[148px] p-[14px] rounded-[18px] bg-reverse shadow-[0_2px_7px_rgba(89,131,240,0.1)]">
              {card.entry}
            </Box>
          </DiscoveryCardContext.Provider>
        ))}
      </HorizontalControlScrollView>
    </WidgetWidthContext.Provider>
  )
}

export default HomeDiscovery
