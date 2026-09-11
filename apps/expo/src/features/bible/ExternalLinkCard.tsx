import { useState } from 'react'
import { Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { getLinkDisplayTitle } from '~helpers/fetchOpenGraphData'
import type { Link } from '~redux/modules/user'

export default function ExternalLinkCard({
  link,
  onOpen,
  onEdit,
}: {
  link: Link
  onOpen: () => void
  onEdit?: () => void
}) {
  const { t } = useTranslation()
  const [failedImage, setFailedImage] = useState<string>()
  let hostname = link.url
  try {
    hostname = new URL(link.url).hostname.replace(/^www\./, '')
  } catch {}
  const image = link.ogData?.image
  return (
    <Box className="bg-reverse border border-border rounded-[16px] p-[16px] gap-[20px]">
      <HStack className="items-center gap-[8px]">
        <FeatherIcon name="link" size={16} color="tertiary" />
        <Text className="flex-1 text-[13px] text-tertiary" numberOfLines={1}>
          {hostname}
        </Text>
        {onEdit && (
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.editLink')}
            onPress={onEdit}
            className="p-[6px] rounded-lg hover:bg-light-grey"
          >
            <FeatherIcon name="edit-2" size={18} color="tertiary" />
          </TouchableBox>
        )}
      </HStack>
      <HStack className="items-start gap-[14px]">
        <Box className="flex-1 min-w-0 gap-[14px]">
          <Text className="font-bold text-[20px] leading-[26px]">{getLinkDisplayTitle(link)}</Text>
          {!!link.ogData?.description && (
            <Text className="text-[14px] leading-[22px] text-grey">{link.ogData.description}</Text>
          )}
        </Box>
        {image && image !== failedImage && (
          <Image
            source={{ uri: image }}
            resizeMode="contain"
            onError={() => setFailedImage(image)}
            style={{ width: 88, height: 116, borderRadius: 12 }}
          />
        )}
      </HStack>
      <TouchableBox
        accessibilityRole="button"
        onPress={onOpen}
        className="bg-primary rounded-[12px] min-h-[44px] px-[12px] py-[12px] flex-row items-center justify-center gap-[8px]"
      >
        <FeatherIcon name="external-link" size={16} color="reverse" />
        <Text className="text-reverse text-[14px] font-medium shrink">
          {t('Ouvrir dans le navigateur')}
        </Text>
      </TouchableBox>
    </Box>
  )
}
