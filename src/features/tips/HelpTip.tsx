import { TouchableOpacity } from 'react-native'
import { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { dismissTipAtom, useTip } from './atom'
import { useSetAtom } from 'jotai/react'

export const HelpTip = ({
  id,
  description,
}: {
  id: string
  description: string
}) => {
  const isDismissed = useTip(id)
  const dismissTip = useSetAtom(dismissTipAtom)

  if (isDismissed) return null

  return (
    <HStack
      gap={10}
      bg="opacity5"
      py={20}
      px={14}
      alignItems="center"
      borderBottomWidth={1}
      borderColor="border"
    >
      <FeatherIcon name="info" size={20} color="tertiary" />
      <Text flex color="tertiary" fontSize={14}>
        {description}
      </Text>
      <TouchableOpacity onPress={() => dismissTip(id)}>
        <FeatherIcon name="x" size={20} color="tertiary" />
      </TouchableOpacity>
    </HStack>
  )
}
