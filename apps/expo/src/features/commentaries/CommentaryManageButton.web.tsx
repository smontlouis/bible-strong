import { useTranslation } from 'react-i18next'
import CommentaryMenu from './CommentaryMenu.web'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
export default function CommentaryManageButton(_props: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <CommentaryMenu
      direct
      accessibilityLabel={t('commentaries.availability.manage')}
      actions={[{ id: 'choose-commentaries', title: t('commentaries.selector.title') }]}
    >
      <Box className="px-[6px] min-h-[44px] items-center justify-center">
        <Text className="text-primary text-[14px] font-bold">
          {t('commentaries.availability.manage')}
        </Text>
      </Box>
    </CommentaryMenu>
  )
}
