// Development prototypes (2026-11-08): the assistant's resource cards as quotations in the flow of
// the answer, like the verse quote: no frame, no tinted bubble, a rule in the resource's colour. Each one shows a real preview of its resource, cut cleanly, then a
// foot line with the resource's mark and name that opens it. Not used by the app yet.
import { useState, type ComponentProps, type ReactNode } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type {
  EntityWidget,
  LexicalWidget,
  NaveWidget,
  SourceGroupWidget,
  StudyWidget,
  TimelineWidget,
} from '@bible-strong/ai-contract/contract'
import ResourceIcon from '~common/icons/ResourceIcon'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { calculateLabel } from '~features/timeline/constants'
import { getEvents } from '~features/timeline/events'
import ListenToStrong from '~features/bible/ListenStrong'
import ResourcePreviewContent from '~features/bibleReferencePreview/ResourcePreviewContent'
import { StrongEditorialPreview, StrongEntitySummaryCard } from '~features/lexique/StrongDetailUI'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { useStrongReadingTypography } from '~features/lexique/useStrongReadingTypography'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import { resolveFontFamily } from '~themes/styleValues'
import { useAssistantSheet } from '../assistantSheetContext'
import { sourceDisplayTitle } from '../sourceNavigation'
import { orderTimelineRows } from '../widgets/timelineRows'

type Mark = ComponentProps<typeof ResourceIcon>['kind'] | 'person' | 'place' | 'timeline'

/** A preview cut at `maxHeight`, faded into the page only when its content is taller. */
function Cut({ maxHeight, children }: { maxHeight: number; children: ReactNode }) {
  const { colors } = useTheme()
  const [tall, setTall] = useState(false)
  return (
    <Box style={{ maxHeight, overflow: 'hidden' }}>
      <Box onLayout={event => setTall(event.nativeEvent.layout.height > maxHeight)}>{children}</Box>
      {tall && (
        <LinearGradient
          pointerEvents="none"
          colors={[colorWithOpacity(colors.reverse, 0) || 'transparent', colors.reverse]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 }}
        />
      )}
    </Box>
  )
}

/** The block every prototype shares: a rule in the resource's colour, its content, its name. */
function Block({
  mark,
  foot,
  onPress,
  children,
}: {
  mark: Mark
  foot: string
  onPress?: () => void
  children: ReactNode
}) {
  const { colors } = useTheme()
  const rule = resolveUniverseColors(
    colors,
    mark === 'person' || mark === 'place' ? 'word' : mark
  ).foreground
  return (
    <TouchableBox
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="my-3 flex-row items-center gap-3"
    >
      <Box className="flex-1 pl-[14px]" style={{ borderLeftWidth: 2, borderLeftColor: rule }}>
        {children}
        <HStack className="mt-[6px] items-center gap-[6px]">
          {mark === 'person' || mark === 'place' || mark === 'timeline' ? (
            <FeatherIcon
              name={mark === 'person' ? 'user' : mark === 'place' ? 'map-pin' : 'clock'}
              size={13}
              color="grey"
            />
          ) : (
            <ResourceIcon kind={mark} size={14} />
          )}
          <Text className="text-link flex-1 text-[13px]" numberOfLines={1}>
            {foot}
          </Text>
        </HStack>
      </Box>
      {onPress && <FeatherIcon name="chevron-right" size={16} color="link" />}
    </TouchableBox>
  )
}

function More({ count, label, onPress }: { count: number; label: string; onPress: () => void }) {
  if (count <= 0) return null
  return (
    <TouchableBox accessibilityRole="button" onPress={onPress} className="self-start py-1">
      <Text className="text-link text-[14px]">{label}</Text>
    </TouchableBox>
  )
}

/** Commentaries and dictionary articles: each excerpt reads as a quotation of its work. */
function SourcesProto({ widget }: { widget: SourceGroupWidget }) {
  const { showSource } = useAssistantSheet()
  const [all, setAll] = useState(false)
  const shown = all ? widget.sources : widget.sources.slice(0, 2)
  return (
    <Box className="my-1">
      {shown.map(source => (
        <Block
          key={source.id}
          mark={source.kind === 'dictionary' ? 'dictionary' : 'commentary'}
          foot={sourceDisplayTitle(source)}
          onPress={() => showSource(source)}
        >
          <Text className="text-[15px] leading-[23px]" numberOfLines={4}>
            {source.excerpt}
          </Text>
        </Block>
      ))}
      <More
        count={widget.sources.length - shown.length}
        label={`Afficher ${widget.sources.length - shown.length} autre(s) extrait(s)`}
        onPress={() => setAll(true)}
      />
    </Box>
  )
}

/** A word of the lexicon: the word, its sound and sense, then the first lines of its entry. */
function StrongProto({ widget }: { widget: LexicalWidget }) {
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const reading = useStrongReadingTypography()
  const query = useQuery({
    queryKey: ['assistant-widget-lexicon', widget.reference, widget.identityKind, widget.language],
    queryFn: () =>
      resources.strongLexicon.loadEntry(
        { kind: widget.identityKind, code: widget.reference },
        widget.language
      ),
    staleTime: 300000,
  })
  const entry = query.data
  const open = (code = widget.reference) =>
    navigate(
      createStrongDetailRoute('index', {
        book: code.startsWith('G') ? 40 : 1,
        identityCode: code,
        identityKind: code === widget.reference ? widget.identityKind : 'dstrong',
      })
    )
  return (
    <Block mark="strong" foot={`${widget.reference} · Lexique Strong`} onPress={() => open()}>
      {!entry ? (
        <Text className="text-grey text-[15px]">{widget.title}</Text>
      ) : (
        <>
          <HStack className="items-center gap-2">
            <Text
              className="text-[22px] leading-[30px]"
              style={{ writingDirection: entry.language === 'hebrew' ? 'rtl' : 'ltr' }}
            >
              {entry.original}
            </Text>
            <Text className="text-grey flex-1 text-[14px]" numberOfLines={1}>
              {entry.transliteration} · {entry.gloss}
            </Text>
            <ListenToStrong
              type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
              code={entry.baseCode}
            />
          </HStack>
          <StrongEditorialPreview
            value={entry.definitionHtml}
            numberOfLines={3}
            readingTypography={{ ...reading, fontSizeScale: -2 }}
            onOpenBibleReference={osis => {
              const route = getBibleViewRouteForStrongOsisReference(osis)
              if (route) navigate(route)
            }}
            onOpenStrong={open}
          />
        </>
      )}
    </Block>
  )
}

/** A person or a place: portrait, name, roles and the first lines of the profile. */
function EntityProto({ widget }: { widget: EntityWidget }) {
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const { fontFamily } = useTheme()
  const query = useQuery({
    queryKey: ['assistant-entity', widget.entityKey, widget.language],
    queryFn: () => resources.strongLexicon.loadEntity(widget.entityKey, widget.language),
    staleTime: 300000,
  })
  const entity = query.data
  const open = () =>
    navigate({
      pathname: '/strong/entity',
      params: { entityKey: widget.entityKey, language: widget.language },
    })
  return (
    <Block
      mark={widget.kind === 'place_profile' ? 'place' : 'person'}
      foot={`Fiche de ${entity?.name || widget.title}`}
      onPress={open}
    >
      {!entity ? (
        <Text className="text-grey text-[15px]">{widget.title}</Text>
      ) : (
        <StrongEntitySummaryCard
          entity={entity}
          plain
          compact
          featured
          previewLines={3}
          editorialTypography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 14,
            lineHeight: 22,
          }}
          readingTypography={{
            fontFamily: resolveFontFamily(fontFamily.text),
            fontSizeScale: -2,
            lineHeight: 'normal',
          }}
          onOpenBibleReference={osis => {
            const route = getBibleViewRouteForStrongOsisReference(osis)
            if (route) navigate(route)
          }}
          onOpenStrong={() => {}}
        />
      )}
    </Block>
  )
}

/** Events in order, each a date, a title and two lines; each opens its event. */
function TimelineProto({ widget }: { widget: TimelineWidget }) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const [all, setAll] = useState(false)
  const query = useQuery({
    queryKey: ['assistant-timeline', widget.events, widget.language],
    queryFn: async () => {
      const [sections, details] = await Promise.all([
        getEvents().catch(() => []),
        Promise.all(widget.events.map(slug => resources.timeline.loadEvent(widget.language, slug))),
      ])
      return orderTimelineRows(
        details.map((detail, index) => {
          if (detail.status !== 'available')
            return {
              slug: widget.events[index],
              meta: sections.flatMap(s => s.events).find(e => e.slug === widget.events[index]),
            }
          const meta = sections.flatMap(s => s.events).find(e => e.slug === detail.detail.slug)
          return { slug: detail.detail.slug, detail: detail.detail, meta }
        })
      )
    },
    staleTime: 300000,
  })
  const events = query.data || []
  const shown = all ? events : events.slice(0, 3)
  return (
    <Block mark="timeline" foot={`Frise chronologique · ${widget.events.length} événements`}>
      {shown.map((event, index) => (
        <TouchableBox
          key={event.slug}
          accessibilityRole="button"
          onPress={() =>
            navigate({
              pathname: '/event',
              params: { slug: event.slug, language: widget.language },
            })
          }
          className={index ? 'mt-3' : ''}
        >
          <Text className="text-grey text-[12px] font-semibold">
            {event.position
              ? calculateLabel(event.position.start, event.position.end, widget.language)
              : event.detail?.dates || t('assistant.widgets.unknownDate')}
          </Text>
          <Text className="text-[15px] font-semibold">
            {event.detail?.title ||
              (widget.language === 'en' ? event.meta?.titleEn : event.meta?.title)}
          </Text>
          <Text className="text-[14px] leading-[21px]" numberOfLines={2}>
            {event.detail?.description}
          </Text>
        </TouchableBox>
      ))}
      <More
        count={events.length - shown.length}
        label={`${events.length - shown.length} autre(s) événement(s)`}
        onPress={() => setAll(true)}
      />
    </Block>
  )
}

/** A topic of Nave: the start of its entry, cut cleanly. */
function NaveProto({ widget }: { widget: NaveWidget }) {
  const navigate = usePushRouteOnce()
  const { fontFamily } = useTheme()
  return (
    <Block
      mark="nave"
      foot={`Nave · ${widget.title}`}
      onPress={() =>
        navigate({
          pathname: '/nave-detail',
          params: { name: widget.topic, name_lower: widget.topic, language: widget.language },
        })
      }
    >
      <Cut maxHeight={132}>
        <ResourcePreviewContent
          typography={{
            fontFamily: resolveFontFamily(fontFamily.text) || 'sans-serif',
            fontSize: 14,
            lineHeight: 22,
          }}
          target={{
            kind: 'nave',
            name: widget.topic,
            title: widget.title,
            source: { kind: 'nave', language: widget.language },
          }}
        />
      </Cut>
    </Block>
  )
}

const PROTOTYPED = new Set<StudyWidget['kind']>([
  'commentary_comparison',
  'dictionary_articles',
  'strong_entry',
  'person_profile',
  'place_profile',
  'event_timeline',
  'nave_topic',
])
export const hasProto = (widget: StudyWidget) => PROTOTYPED.has(widget.kind)

/** The prototype of a card, or null when this kind has none yet. */
export function ProtoCard({ widget }: { widget: StudyWidget }) {
  if (widget.kind === 'commentary_comparison' || widget.kind === 'dictionary_articles')
    return <SourcesProto widget={widget} />
  if (widget.kind === 'strong_entry') return <StrongProto widget={widget} />
  if (widget.kind === 'person_profile' || widget.kind === 'place_profile')
    return <EntityProto widget={widget} />
  if (widget.kind === 'event_timeline') return <TimelineProto widget={widget} />
  if (widget.kind === 'nave_topic') return <NaveProto widget={widget} />
  return null
}
