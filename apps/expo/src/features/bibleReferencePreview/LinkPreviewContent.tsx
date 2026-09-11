import { Linking } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import ExternalLinkCard from '~features/bible/ExternalLinkCard'
import EntityChipList from '~common/EntityChipList'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { makeLinkByIdSelector } from '~redux/selectors/bible'
import type { RootState } from '~redux/modules/reducer'
import { createExternalLinkEndpointFromLink } from '~features/studyRelations/endpoints'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { toast } from '~helpers/toast'

export default function LinkPreviewContent({ linkId }: { linkId: string }) {
  const selector = makeLinkByIdSelector()
  const link = useSelector((state: RootState) => selector(state, linkId))
  const { t } = useTranslation()
  const endpoint = link ? createExternalLinkEndpointFromLink(linkId, link) : null
  const count = useRelationCount(endpoint)
  const openRelations = useOpenEntityRelations()
  if (!link) return <Text className="text-grey">{t('referencePreview.unavailable')}</Text>
  return (
    <Box className="gap-[12px]">
      <ExternalLinkCard
        link={link}
        onOpen={() => {
          void Linking.openURL(link.url).catch(() => toast.error(t("Impossible d'ouvrir ce lien")))
        }}
      />
      <EntityChipList
        tags={link.tags}
        relationCount={count}
        onRelationPress={() => endpoint && openRelations(endpoint)}
      />
    </Box>
  )
}
