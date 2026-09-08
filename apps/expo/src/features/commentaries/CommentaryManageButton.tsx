import { useTranslation } from 'react-i18next'
import { LinkBox } from '~common/Link'
import Text from '~common/ui/Text'
export default function CommentaryManageButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <LinkBox className="px-[6px] min-h-[44px] items-center justify-center" onPress={onPress}>
      <Text className="text-primary text-[14px] font-bold">
        {t('commentaries.availability.manage')}
      </Text>
    </LinkBox>
  )
}
