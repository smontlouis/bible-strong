import { ActivityIndicator } from 'react-native'
import { VStack } from '~common/ui/Box'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'

export const LoadingView = ({
  isBibleViewReloadingAtom,
}: {
  isBibleViewReloadingAtom: PrimitiveAtom<boolean>
}) => {
  const isBibleViewReloading = useAtomValue(isBibleViewReloadingAtom)

  if (!isBibleViewReloading) {
    return null
  }

  return (
    <VStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      justifyContent="center"
      alignItems="center"
      backgroundColor="rgba(0, 0, 0, 0.24)"
      pointerEvents="none"
    >
      <ActivityIndicator />
    </VStack>
  )
}
