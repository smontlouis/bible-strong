import { useTheme } from '~themes/ThemeProvider'
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
        <Stack.Screen name="[code]/index" />
        <Stack.Screen name="[code]/dictionary" />
        <Stack.Screen name="[code]/related" />
        <Stack.Screen name="[code]/concordance" />
        <Stack.Screen name="entity/[uniqueName]" />
        <Stack.Screen name="entity" />
        <Stack.Screen name="dictionary" />
        <Stack.Screen name="related" />
        <Stack.Screen name="concordance" />
      </Stack>
    </ModalRouteFrame>
  )
}

export default StrongLayout
