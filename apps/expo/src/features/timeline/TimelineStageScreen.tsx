import { useSetAtom } from 'jotai/react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import Header from '~common/Header'
import { type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import {
  RESOURCE_SHARE_ICONS,
  resourceShareMenuActions,
  runResourceShareAction,
  type ResourceShare,
} from '~features/share/resourceShare'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import generateUUID from '~helpers/generateUUID'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import { toast } from '~helpers/toast'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useResourceLanguage } from 'src/state/resourcesLanguage'
import TimelineHomeDetailModal from './TimelineHomeDetailModal'
import TimelineResourceBoundary from './TimelineResourceBoundary'
import TimelineStage, { type TimelineStagePosition, type TimelineStageStart } from './TimelineStage'
import { buildPublicTimelineIndexPath } from './publicTimelineRoutes'
import { timelineUnderSheetAtom } from './timelineStageAtoms'

type Props = {
  /** The language of the publication shown, when the address names it. */
  languageOverride?: ResourceLanguage
  onLanguageChange?: (language: ResourceLanguage) => void
  start?: TimelineStageStart
  hasBackButton?: boolean
  onPositionChange?: (position: TimelineStagePosition) => void
}

/** The timeline page: its header, and the stage under it. */
const TimelineStageScreen = ({
  languageOverride,
  onLanguageChange,
  start,
  hasBackButton = true,
  onPositionChange,
}: Props) => {
  const { t } = useTranslation()
  const detailsRef = useRef<SheetRef>(null)
  const position = useRef<TimelineStagePosition>(undefined)
  const pushRouteOnce = usePushRouteOnce()
  const openInNewTab = useOpenInNewTab()
  const setUnderSheet = useSetAtom(timelineUnderSheetAtom)
  const [preferredLanguage, setPreferredLanguage] = useResourceLanguage('TIMELINE')
  const language = languageOverride ?? preferredLanguage

  const share: ResourceShare = {
    url: getPublicSiteUrl(() => buildPublicTimelineIndexPath(language)),
    title: t('La Chronologie biblique'),
    text: () => t('La Chronologie biblique'),
  }

  const toggleLanguage = () => {
    const next = language === 'fr' ? 'en' : 'fr'
    if (onLanguageChange) onLanguageChange(next)
    else setPreferredLanguage(next)
    toast(t('menu.languageChanged', { language: next === 'fr' ? 'Français' : 'English' }))
  }

  const openTimelineInNewTab = () =>
    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: t('Chronologie de la Bible'),
      isRemovable: true,
      type: 'timeline',
      data: {
        ...(languageOverride ? { language: languageOverride } : {}),
        ...(position.current?.period ? { year: position.current.year } : {}),
      },
    })

  return (
    <FormSheetScreen className="bg-canvas">
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <Header
          hasBackButton={hasBackButton}
          title={t('La Chronologie biblique')}
          rightComponent={
            <Box className="flex-row items-center">
              <TouchableBox
                className="h-[54px] w-[44px] items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={t('Recherche')}
                onPress={() => {
                  // An event found opens over the timeline, which goes to it.
                  setUnderSheet(true)
                  pushRouteOnce({ pathname: '/timeline-search' })
                }}
              >
                <FeatherIcon name="search" size={19} />
              </TouchableBox>
              <ContextualMenu
                panelTitle={t('La Chronologie biblique')}
                icons={{
                  language: 'globe',
                  details: 'info',
                  'open-tab': 'external-link',
                  ...RESOURCE_SHARE_ICONS,
                }}
                screens={{
                  details: {
                    title: t('Détails'),
                    width: 500,
                    content: () => <TimelineHomeDetailModal inline modalRef={detailsRef} />,
                  },
                }}
                actions={[
                  {
                    id: 'language',
                    title: `${t('menu.language')}: ${language === 'fr' ? 'Français' : 'English'}`,
                    image: 'globe',
                  },
                  { id: 'details', title: t('Détails'), image: 'info.circle' },
                  ...resourceShareMenuActions(t, share),
                  {
                    id: 'open-tab',
                    title: t('tab.openInNewTab'),
                    image: 'arrow.up.forward.square',
                  },
                ]}
                onPressAction={({ nativeEvent }) => {
                  if (runResourceShareAction(nativeEvent.event, share)) return
                  switch (nativeEvent.event) {
                    case 'language':
                      toggleLanguage()
                      break
                    case 'details':
                      detailsRef.current?.present()
                      break
                    case 'open-tab':
                      openTimelineInNewTab()
                      break
                  }
                }}
              >
                <Box className="h-[54px] w-[44px] flex-row items-center justify-center">
                  <FeatherIcon name="more-vertical" size={18} />
                </Box>
              </ContextualMenu>
            </Box>
          }
        />
        <TimelineResourceBoundary language={language}>
          <TimelineStage
            // Another language is another publication, drawn anew.
            key={language}
            language={language}
            start={start}
            onOpenEvent={slug => pushRouteOnce({ pathname: '/event', params: { slug, language } })}
            onPositionChange={current => {
              position.current = current
              onPositionChange?.(current)
            }}
          />
        </TimelineResourceBoundary>
        <TimelineHomeDetailModal modalRef={detailsRef} />
      </Box>
    </FormSheetScreen>
  )
}

export default TimelineStageScreen
