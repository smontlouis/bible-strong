import { useTheme } from '~themes/ThemeProvider'
import { Stack } from 'expo-router'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
const TimelineSearchLayout = () => {
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
        <Stack.Screen name="timeline-search" />
      </Stack>
    </ModalRouteFrame>
  )
}

export default TimelineSearchLayout
