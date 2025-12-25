import { TouchableOpacity } from 'react-native'
import { BoxProps, HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { dismissTipAtom, useTip } from './atom'
import { useSetAtom } from 'jotai/react'

export const HelpTip = ({
  id,
  description,
  type = 'info',
  ...props
}: {
  id: string
  description: string
  type?: 'info' | 'warning'
} & BoxProps) => {
  const isDismissed = useTip(id)
  const dismissTip = useSetAtom(dismissTipAtom)

  if (isDismissed) return null

  return (
    <HStack
      gap={10}
      bg={type === 'info' ? 'opacity50' : 'quart'}
      py={10}
      px={14}
      alignItems="center"
      marginHorizontal={10}
      style={{ boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.1)', borderRadius: 10 }}
      {...props}
    >
      <FeatherIcon
        name={type === 'info' ? 'info' : 'alert-triangle'}
        size={20}
        color={type === 'info' ? 'tertiary' : 'reverse'}
      />
      <Text flex color={type === 'info' ? 'tertiary' : 'reverse'} fontSize={14}>
        {description}
      </Text>
      <TouchableOpacity onPress={() => dismissTip(id)}>
        <FeatherIcon name="x" size={20} color={type === 'info' ? 'tertiary' : 'reverse'} />
      </TouchableOpacity>
    </HStack>
  )
}
