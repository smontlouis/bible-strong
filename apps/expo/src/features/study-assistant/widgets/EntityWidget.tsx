import { Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { EntityWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { StrongEntitySummaryCard } from '~features/lexique/StrongDetailUI'
import { StrongEntityRelationGraph } from '~features/lexique/StrongEntityRelationGraph'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import WidgetFrame, {
  WidgetDisclosure,
  WidgetLoading,
  WidgetNotice,
  WidgetOpenButton,
  WidgetUnavailable,
} from './WidgetFrame'

function EntityBody({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    { fontFamily } = useTheme()
  const query = useQuery({
    queryKey: ['assistant-entity', widget.entityKey, widget.language],
    queryFn: () => resources.strongLexicon.loadEntity(widget.entityKey, widget.language),
    staleTime: 300000,
  })
  const entity = query.data
  const open = (id = widget.entityKey) =>
    navigate({ pathname: '/strong/entity', params: { entityKey: id, language: widget.language } })
  if (query.isPending) return <WidgetLoading />
  if (query.isError || !entity) return <WidgetUnavailable onRetry={() => void query.refetch()} />
  const place = entity.place
  const coords =
    place &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.latitude!) <= 90 &&
    Math.abs(place.longitude!) <= 180
  return (
    <>
      {widget.kind === 'entity_relations' ? (
        <>
          <StrongEntityRelationGraph
            entity={entity}
            currentProfileEntityKey={entity.uniqueName}
            languageOverride={widget.language}
            onOpenProfile={open}
            onOpenEntity={relation => {
              if (relation.targetUniqueName) open(relation.targetUniqueName)
            }}
          />
          <WidgetNotice>{t('assistant.widgets.relationNotice')}</WidgetNotice>
          <WidgetDisclosure
            title={t('assistant.widgets.relationDetailsFor', { name: entity.name })}
          >
            {entity.relations.map((r, i) => (
              <Box key={i} className="py-1">
                <Text className="text-[14px]">
                  {t(`strongDetail.entity.relation.${r.relation}`, { defaultValue: r.relation })} ·{' '}
                  {r.targetName}
                </Text>
                <Text className="text-grey text-[12px]">
                  {r.certainty || t('assistant.widgets.certaintyUnspecified')}
                </Text>
              </Box>
            ))}
          </WidgetDisclosure>
        </>
      ) : (
        <StrongEntitySummaryCard
          entity={entity}
          plain
          compact
          editorialTypography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 13,
            lineHeight: 21,
          }}
          readingTypography={{
            fontFamily: resolveFontFamily(fontFamily.text),
            fontSizeScale: 0,
            lineHeight: 'normal',
          }}
          onOpenBibleReference={osis => {
            const route = getBibleViewRouteForStrongOsisReference(osis)
            if (route) navigate(route)
          }}
          onOpenStrong={code =>
            navigate(
              createStrongDetailRoute('index', {
                book: code.startsWith('G') ? 40 : 1,
                identityCode: code,
                identityKind: 'dstrong',
              })
            )
          }
        />
      )}
      {entity.category === 'place' && place && (
        <HStack className="gap-2 pt-2">
          <FeatherIcon name="map-pin" size={16} color="grey" />
          <Box className="flex-1">
            <Text className="text-[14px] font-semibold">{place.name || entity.name}</Text>
            {!!place.area && <Text className="text-grey text-[13px]">{place.area}</Text>}
            {coords && (
              <TouchableBox
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=10/${place.latitude}/${place.longitude}`
                  ).catch(() => {})
                }
                className="self-start py-1"
              >
                <Text className="text-link text-[13px]">
                  {t('assistant.widgets.map')} · {Number(place.latitude).toFixed(4)},{' '}
                  {Number(place.longitude).toFixed(4)}
                </Text>
              </TouchableBox>
            )}
          </Box>
        </HStack>
      )}
      <Box className="pt-2">
        <WidgetOpenButton
          label={t('assistant.widgets.open', { reference: entity.name })}
          onPress={() => open()}
        />
      </Box>
    </>
  )
}

export default function EntityWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  return (
    <WidgetFrame
      icon={
        widget.kind === 'entity_relations'
          ? 'share-2'
          : widget.kind === 'place_profile'
            ? 'map-pin'
            : 'user'
      }
      title={widget.title}
      eyebrow={t(`assistant.widgets.${widget.kind}`)}
    >
      <Box className="px-3 py-[10px]">
        <EntityBody widget={widget} />
      </Box>
    </WidgetFrame>
  )
}
