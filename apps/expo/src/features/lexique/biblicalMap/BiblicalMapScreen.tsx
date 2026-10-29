import { biblicalMapBounds } from '@bible-strong/resource-domain/biblical-map'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Text from '~common/ui/Text'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { useTheme } from '~themes/ThemeProvider'
import { useStrongRouteNavigation } from '../useStrongRouteNavigation'
import BiblicalMapDOM from './BiblicalMapDOM'
import { useBiblicalPlaces } from './useBiblicalPlaces'

/**
 * The map of every place of the Bible, travelled with the fingers in a web view, as the public
 * atlas is. It opens on a place and its surroundings, on the places of a chapter brought forward,
 * or on the Promised Land. A place touched opens its page.
 */
const BiblicalMapScreen = ({
  focus,
  placeNames,
  title,
  isFormSheet,
}: {
  focus?: string
  /** The places brought forward, the others dimmed: the places of a chapter. */
  placeNames?: string[]
  title?: string
  isFormSheet?: boolean
}) => {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const canGoBack = useCanGoBackInStack()
  const navigation = useStrongRouteNavigation({})
  const { places, loading } = useBiblicalPlaces()
  const highlighted = useMemo(() => new Set(placeNames ?? []), [placeNames])
  const region = useMemo(() => {
    if (focus) {
      const self = places.find(place => place.uniqueName === focus)
      return self ? biblicalMapBounds([self], 200) : undefined
    }
    return biblicalMapBounds(places.filter(place => highlighted.has(place.uniqueName)))
  }, [places, focus, highlighted])
  const missing = Boolean(placeNames?.length) && !loading && !region
  // The web view leaves its moves unclaimed, so iOS gives a drag down to the sheet, which leaves
  // with the map. This pan does nothing but claim them; the page still gets every touch, and the
  // sheet still moves by its header.
  const holdSheet = useMemo(() => Gesture.Pan().cancelsTouchesInView(false), [])

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={isFormSheet ? canGoBack : true}
        title={title || t('strongDetail.entity.mapTitle')}
      />
      <Box className="overflow-hidden border-continuous flex-[1]">
        {loading ? (
          <Loading message={t('Chargement...')} />
        ) : (
          <GestureDetector gesture={holdSheet}>
            <View collapsable={false} style={{ flex: 1 }}>
              <BiblicalMapDOM
                places={[...places]}
                focus={focus}
                highlighted={placeNames}
                region={region}
                colors={{
                  sea: colors.lightPrimary,
                  land: colors.surface,
                  coast: colors.separator,
                  water: colors.primary,
                  lakeOpacity: 0.35,
                  riverOpacity: 0.45,
                  place: colors.tertiary,
                  accent: colors.primary,
                  halo: colors.surface,
                  ink: colors.default,
                  nameHalo: colors.surface,
                  control: colors.surfaceRaised,
                  controlInk: colors.default,
                  controlLine: colors.separator,
                }}
                labels={{
                  map: t('strongDetail.entity.mapLabel'),
                  zoomIn: t('strongDetail.entity.mapZoomIn'),
                  zoomOut: t('strongDetail.entity.mapZoomOut'),
                  whole: t('strongDetail.entity.mapWhole'),
                }}
                onOpenPlace={navigation.openEntity}
                dom={{
                  useExpoDOMWebView: false,
                  webviewDebuggingEnabled: __DEV__,
                  scrollEnabled: false,
                  bounces: false,
                  style: { flex: 1, backgroundColor: colors.lightPrimary },
                  containerStyle: { flex: 1, backgroundColor: colors.lightPrimary },
                }}
              />
            </View>
          </GestureDetector>
        )}
        {missing && (
          <Box
            className="overflow-hidden border-continuous bg-surface-raised rounded-[12px] px-[14px] py-[10px]"
            style={{ position: 'absolute', left: 12, right: 12, top: 12 }}
          >
            <Text className="text-[14px]">{t('strongDetail.entity.mapNoPlace')}</Text>
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BiblicalMapScreen
