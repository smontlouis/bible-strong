import { useTheme } from '@emotion/react'
import { Stack } from 'expo-router'
import ModalRouteFrame from '~navigation/ModalRouteFrame'

const StrongLayout = () => {
  const theme = useTheme()

  return (
    <ModalRouteFrame>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.reverse,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="entity" />
        <Stack.Screen name="dictionary" />
        <Stack.Screen name="related" />
        <Stack.Screen name="concordance" />
      </Stack>
    </ModalRouteFrame>
  )
}

export default StrongLayout
