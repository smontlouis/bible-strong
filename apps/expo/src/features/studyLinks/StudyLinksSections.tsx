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
import { StudyMoreRow, StudySection } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { STUDY_LINK_SECTIONS, STUDY_LINKS_SHOWN, studyLinkRoute } from './studyLinksPresentation'

const StudyLinkRow = ({ link, onPress }: { link: StudyLinkView; onPress: () => void }) => (
  <TouchableBox
    className="flex-row items-center gap-[12px] px-[16px] py-[12px]"
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={link.detail ? `${link.label}, ${link.detail}` : link.label}
  >
    <VStack className="flex-[1] gap-[2px]">
      <Text className="text-[15px]" numberOfLines={2}>
        {link.label}
      </Text>
      {link.detail ? (
        <Text className="text-[13px] text-grey" numberOfLines={1}>
          {link.detail}
        </Text>
      ) : null}
    </VStack>
    <FeatherIcon name="chevron-right" color="grey" size={18} />
  </TouchableBox>
)

const StudyLinksSection = ({
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
    <StudySection title={title} surface="rows">
      {shown.map(link => (
        <StudyLinkRow
          key={`${link.kind}:${link.key}`}
          link={link}
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

/** What the other study resources hold on this subject, one section per resource. */
const StudyLinksSections = ({
  kind,
  subjectKey,
  language,
}: {
  kind: StudyLinkKind
  subjectKey?: string
  language: StudyLinkLanguage
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const { data: links = [] } = useQuery({
    queryKey: ['study-links', kind, subjectKey, language],
    queryFn: ({ signal }) =>
      resources.studyLinks.load({ kind, key: subjectKey ?? '' }, language, signal),
    enabled: Boolean(subjectKey),
    staleTime: Infinity,
    networkMode: 'always',
  })
  return (
    <>
      {STUDY_LINK_SECTIONS.map(section => {
        const sectionLinks = links.filter(link => link.kind === section.kind)
        return sectionLinks.length > 0 ? (
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
