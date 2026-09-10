import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useReadingTypography } from '~common/useReadingTypography'
import type { RootState } from '~redux/modules/reducer'
import { studyPreviewText } from './studyPreviewText'

export default function StudyPreviewContent({ studyId }: { studyId: string }) {
  const study = useSelector((state: RootState) => state.user.bible.studies[studyId])
  const { t } = useTranslation()
  const typography = useReadingTypography()
  if (!study) return <Text className="text-grey text-[14px]">{t("Cette étude n'existe plus")}</Text>
  return (
    <Box className="gap-[8px]">
      {!!study.title && <Text className="font-semibold text-[16px]">{study.title}</Text>}
      <Text style={{ fontFamily: typography.fontFamily, fontSize: 16, lineHeight: 24 }}>
        {studyPreviewText(study.content)}
      </Text>
    </Box>
  )
}
