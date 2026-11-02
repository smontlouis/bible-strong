import type {
  StudyLinkKind,
  StudyLinkLanguage,
  StudyLinkView,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { ICON_TILE_SIZE } from '~common/ui/IconTile'
import ResourceTile from '~common/ui/ResourceTile'
import { STUDY_CARD_INSET, StudyMoreRow, StudySection } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import StrongEntityAvatar from '~features/lexique/StrongEntityAvatar'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import {
  STUDY_LINK_SECTIONS,
  STUDY_LINKS_SHOWN,
  studyLinkDetail,
  studyLinkRoute,
} from './studyLinksPresentation'

const ROW_GAP = 12

/** A person or a place wears its portrait; a resource, its mark. */
const StudyLinkMark = ({ link }: { link: StudyLinkView }) =>
  link.kind === 'entity' ? (
    <StrongEntityAvatar uniqueName={link.key} category="other" type="" size={ICON_TILE_SIZE} />
  ) : (
    <ResourceTile kind={link.kind} />
  )

const StudyLinkRow = ({
  link,
  detail,
  onPress,
}: {
  link: StudyLinkView
  detail?: string
  onPress: () => void
}) => (
  <TouchableBox
    className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={detail ? `${link.label}, ${detail}` : link.label}
  >
    <StudyLinkMark link={link} />
    <VStack className="flex-[1] gap-[2px]">
      <Text className="text-[15px]" numberOfLines={2}>
        {link.label}
      </Text>
      {detail ? (
        <Text className="text-[13px] text-grey" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </VStack>
    <FeatherIcon name="chevron-right" color="grey" size={18} />
  </TouchableBox>
)

export const StudyLinksSection = ({
  title,
  links,
  language,
}: {
  title: string
  links: StudyLinkView[]
  language: StudyLinkLanguage
}) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? links : links.slice(0, STUDY_LINKS_SHOWN)
  return (
    <StudySection
      title={title}
      surface="rows"
      rowInset={STUDY_CARD_INSET + ICON_TILE_SIZE + ROW_GAP}
    >
      {shown.map(link => (
        <StudyLinkRow
          key={`${link.kind}:${link.key}`}
          link={link}
          detail={studyLinkDetail(link, links)}
          onPress={() => pushRouteOnce(studyLinkRoute(link, language))}
        />
      ))}
      {!expanded && links.length > STUDY_LINKS_SHOWN ? (
        <StudyMoreRow
          key="more"
          label={t('studyLinks.showAll', { count: links.length })}
          onPress={() => setExpanded(true)}
        />
      ) : null}
    </StudySection>
  )
}

const NO_LINKS: StudyLinkView[] = []

/** The links of a subject, kept for the session: a page reads them once for all its sections. */
export const useStudyLinks = (
  kind: StudyLinkKind,
  subjectKey: string | undefined,
  language: StudyLinkLanguage
) => {
  const resources = useResourceAccess()
  const { data = NO_LINKS } = useQuery({
    queryKey: ['study-links', kind, subjectKey, language],
    queryFn: ({ signal }) =>
      resources.studyLinks.load({ kind, key: subjectKey ?? '' }, language, signal),
    enabled: Boolean(subjectKey),
    staleTime: Infinity,
    networkMode: 'always',
  })
  return data
}

/** What the other study resources hold on this subject, one section per resource. */
const StudyLinksSections = ({
  kind,
  subjectKey,
  language,
  without,
}: {
  kind: StudyLinkKind
  subjectKey?: string
  language: StudyLinkLanguage
  /** A resource the page shows in its own way. */
  without?: StudyLinkKind
}) => {
  const { t } = useTranslation()
  const links = useStudyLinks(kind, subjectKey, language)
  return (
    <>
      {STUDY_LINK_SECTIONS.map(section => {
        const sectionLinks = links.filter(link => link.kind === section.kind)
        return sectionLinks.length > 0 && section.kind !== without ? (
          <StudyLinksSection
            key={section.kind}
            title={t(section.titleKey)}
            links={sectionLinks}
            language={language}
          />
        ) : null
      })}
    </>
  )
}

export default StudyLinksSections
