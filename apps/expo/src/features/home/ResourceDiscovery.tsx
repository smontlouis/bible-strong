import ResourceIcon from '~common/icons/ResourceIcon'
import { useFonts } from 'expo-font'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView } from '~common/ui/MenuView'
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
      route: 'Lexique' as const,
      action: t('home.discovery.openLexicon'),
      entry: <StrongOfTheDay type="hebreu" discovery />,
    },
    {
      id: 'greek',
      label: t('Grec'),
      kind: 'strong' as const,
      route: 'Lexique' as const,
      action: t('home.discovery.openLexicon'),
      entry: <StrongOfTheDay type="grec" discovery />,
    },
    {
      id: 'nave',
      label: t('tabs.nave'),
      kind: 'nave' as const,
      route: 'Nave' as const,
      action: t('home.discovery.openNave'),
      entry: <NaveOfTheDay discovery />,
    },
    {
      id: 'dictionary',
      label: t('tabs.dictionary'),
      kind: 'dictionary' as const,
      route: 'Dictionnaire' as const,
      action: t('home.discovery.openDictionary'),
      entry: <WordOfTheDay discovery />,
    },
  ]
  return (
    <section aria-label={t('newTab.library')}>
      <div className="bs-home-discovery-heading">
        <Box className="gap-[6px]">
          <Text
            accessibilityRole="header"
            className="text-[24px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
          >
            {t('newTab.library')}
          </Text>
          <Text className="text-grey text-[15px]">{t('home.discovery.subtitle')}</Text>
        </Box>
        <MenuView
          accessibilityLabel={t('home.discovery.allResources')}
          actions={[
            { id: 'lexique', title: t('Lexique') },
            { id: 'nave', title: t('tabs.nave') },
            { id: 'dictionnaire', title: t('tabs.dictionary') },
            { id: 'commentary-library', title: t('tabs.commentary') },
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
          <Box className="flex-row items-center justify-center gap-[10px] px-[16px] min-h-[44px] rounded-[12px] border border-border">
            <Text className="text-[14px] font-medium">{t('home.discovery.allResources')}</Text>
            <FeatherIcon name="arrow-right" size={19} color="grey" />
          </Box>
        </MenuView>
      </div>
      <WidgetWidthContext.Provider value="100%">
        <div className="bs-home-discovery-grid">
          {rows.map(row => (
            <Box
              key={row.id}
              className="bs-home-discovery-card border rounded-[18px]"
              style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.reverse }}
            >
              <Box className="bs-home-discovery-category min-w-0">
                <Link
                  route={row.route}
                  accessibilityLabel={`${row.action} · ${row.label}`}
                  className="self-start flex-row items-center gap-[8px] min-h-[36px]"
                >
                  <ResourceIcon kind={row.kind} size={30} />
                  <Text className="text-[14px] font-bold shrink" numberOfLines={1}>
                    {row.label}
                  </Text>
                </Link>
              </Box>
              {row.entry}
            </Box>
          ))}
        </div>
      </WidgetWidthContext.Provider>
    </section>
  )
}
