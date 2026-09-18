import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon, MapPinIcon, UserRoundIcon, NetworkIcon } from 'lucide-react'
import type { EntityWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { StrongEntitySummaryCard } from '~features/lexique/StrongDetailUI'
import { StrongEntityRelationGraph } from '~features/lexique/StrongEntityRelationGraph'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import WidgetFrame, { useCloseExpandedWidget } from './WidgetFrame.web'
function EntityBody({ widget, expanded = false }: { widget: Descriptor; expanded?: boolean }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    close = useCloseExpandedWidget(),
    { fontFamily } = useTheme()
  const query = useQuery({
    queryKey: ['assistant-entity', widget.entityKey, widget.language],
    queryFn: () => resources.strongLexicon.loadEntity(widget.entityKey, widget.language),
    staleTime: 300000,
  })
  const entity = query.data
  const open = (id = widget.entityKey) => {
    close()
    navigate({ pathname: '/strong/entity', params: { entityKey: id, language: widget.language } })
  }
  if (query.isPending)
    return (
      <div className="bs-widget-entity" role="status">
        {t('Chargement...')}
      </div>
    )
  if (query.isError || !entity)
    return (
      <div className="bs-widget-entity">
        <p>{t('assistant.widgets.resourceUnavailable')}</p>
        <button type="button" onClick={() => void query.refetch()}>
          {t('assistant.errors.retry')}
        </button>
      </div>
    )
  const place = entity.place
  const coords =
    place &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.latitude!) <= 90 &&
    Math.abs(place.longitude!) <= 180
  return (
    <div className="bs-widget-entity">
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
          <p className="bs-widget-notice">{t('assistant.widgets.relationNotice')}</p>
          <details>
            <summary>{t('assistant.widgets.relationDetailsFor', { name: entity.name })}</summary>
            <ul className="bs-widget-relation-list">
              {entity.relations.map((r, i) => (
                <li key={i}>
                  <span>
                    {t(`strongDetail.entity.relation.${r.relation}`, { defaultValue: r.relation })}{' '}
                    · {r.targetName}
                  </span>
                  <small>{r.certainty || t('assistant.widgets.certaintyUnspecified')}</small>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <StrongEntitySummaryCard
          entity={entity}
          plain
          compact
          expanded={expanded}
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
            if (route) {
              close()
              navigate(route)
            }
          }}
          onOpenStrong={code => {
            close()
            navigate(
              createStrongDetailRoute('index', {
                book: code.startsWith('G') ? 40 : 1,
                identityCode: code,
                identityKind: 'dstrong',
              })
            )
          }}
        />
      )}
      {entity.category === 'place' && place && (
        <div className="bs-widget-place">
          <MapPinIcon size={16} />
          <div>
            <strong>{place.name || entity.name}</strong>
            {place.area && <p>{place.area}</p>}
            {coords && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=10/${place.latitude}/${place.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('assistant.widgets.map')} · {Number(place.latitude).toFixed(4)},{' '}
                {Number(place.longitude).toFixed(4)}
              </a>
            )}
          </div>
        </div>
      )}
      <button type="button" className="bs-widget-resource-open" onClick={() => open()}>
        {t('assistant.widgets.open', { reference: entity.name })}
        <ArrowUpRightIcon size={15} />
      </button>
    </div>
  )
}
export default function EntityWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  return (
    <WidgetFrame
      icon={
        widget.kind === 'entity_relations' ? (
          <NetworkIcon size={17} />
        ) : widget.kind === 'place_profile' ? (
          <MapPinIcon size={17} />
        ) : (
          <UserRoundIcon size={17} />
        )
      }
      title={widget.title}
      eyebrow={t(`assistant.widgets.${widget.kind}`)}
      expanded={<EntityBody widget={widget} expanded />}
    >
      <EntityBody widget={widget} />
    </WidgetFrame>
  )
}
