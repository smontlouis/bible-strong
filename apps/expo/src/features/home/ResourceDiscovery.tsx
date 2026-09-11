import ResourceIcon from '~common/icons/ResourceIcon'
import { useFonts } from 'expo-font'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView } from '~common/ui/MenuView.web'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import StrongOfTheDay from './StrongOfTheDay'
import NaveOfTheDay from './NaveOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import { WidgetWidthContext } from './widget'

export default function ResourceDiscovery() {
  useFonts({ 'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf') })
  const { t } = useTranslation()
  const theme = useTheme()
  const pushRoute = usePushRouteOnce()
  const rows = [
    {
      id: 'hebrew',
      label: t('Hébreu'),
      kind: 'strong' as const,
      entry: <StrongOfTheDay type="hebreu" discovery />,
    },
    {
      id: 'greek',
      label: t('Grec'),
      kind: 'strong' as const,
      entry: <StrongOfTheDay type="grec" discovery />,
    },
    {
      id: 'nave',
      label: t('tabs.nave'),
      kind: 'nave' as const,
      entry: <NaveOfTheDay discovery />,
    },
    {
      id: 'dictionary',
      label: t('tabs.dictionary'),
      kind: 'dictionary' as const,
      entry: <WordOfTheDay discovery />,
    },
  ]
  return (
    <section aria-label={t('newTab.library')}>
      <div className="bs-home-discovery-heading">
        <Box className="gap-[6px]">
          <Text
            accessibilityRole="header"
            className="text-[22px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
          >
            {t('newTab.library')}
          </Text>
          <Text className="text-grey text-[15px]">{t('home.discovery.subtitle')}</Text>
        </Box>
        <MenuView
          accessibilityLabel={t('home.discovery.allResources')}
          renderActionIcon={action => {
            const kinds = {
              lexique: 'strong',
              nave: 'nave',
              dictionnaire: 'dictionary',
              'commentary-library': 'commentary',
            } as const
            const kind = kinds[action.id as keyof typeof kinds]
            return kind ? <ResourceIcon kind={kind} size={20} /> : null
          }}
          actions={[
            { id: 'lexique', title: t('Lexique'), image: 'textformat' },
            { id: 'nave', title: t('tabs.nave'), image: 'square.stack.3d.up' },
            { id: 'dictionnaire', title: t('tabs.dictionary'), image: 'book' },
            {
              id: 'commentary-library',
              title: t('tabs.commentary'),
              image: 'bubble.left.and.bubble.right',
            },
          ]}
          onPressAction={({ nativeEvent }) => {
            const routes = {
              lexique: '/(library)/lexique',
              nave: '/(library)/nave',
              dictionnaire: '/(library)/dictionnaire',
              'commentary-library': '/commentary-library',
            } as const
            const route = routes[nativeEvent.event as keyof typeof routes]
            if (route) pushRoute({ pathname: route })
          }}
        >
          <Box className="flex-row items-center justify-center gap-[10px] px-[16px] min-h-[44px] rounded-[12px] bg-reverse shadow-[0_2px_7px_rgba(89,131,240,0.1)]">
            <Text className="text-[14px] font-medium">{t('home.discovery.allResources')}</Text>
            <FeatherIcon name="chevron-down" size={16} color="grey" />
          </Box>
        </MenuView>
      </div>
      <WidgetWidthContext.Provider value="100%">
        <div className="bs-home-discovery-grid">
          {rows.map(row => (
            <Box
              key={row.id}
              className="bs-home-discovery-card rounded-[18px] shadow-[0_2px_7px_rgba(89,131,240,0.1)]"
              style={{ backgroundColor: theme.colors.reverse }}
            >
              <Box className="bs-home-discovery-icon items-center justify-center bg-light-grey rounded-[14px]">
                <ResourceIcon kind={row.kind} size={32} />
              </Box>
              {row.entry}
            </Box>
          ))}
        </div>
      </WidgetWidthContext.Provider>
    </section>
  )
}
