import { useTheme } from '~themes/ThemeProvider'
import { Stack } from 'expo-router'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
const CommentaryLayout = () => {
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
        <Stack.Screen name="commentary-chapter" />
        <Stack.Screen name="commentary-entry" />
      </Stack>
    </ModalRouteFrame>
  )
}

export default CommentaryLayout
