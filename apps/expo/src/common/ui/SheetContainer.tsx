import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export function SheetContainer({
  children,
  scrollView = false,
  useSafeArea = false,
}: {
  children: React.ReactNode
  scrollView?: boolean
  useSafeArea?: boolean
}) {
  const scrollViewHeight = SCREEN_HEIGHT
  const scrollViewPaddingBottom = SCREEN_HEIGHT * 0.3

  return (
    <View style={styles.container}>
      {scrollView ? (
        <View style={styles.content}>
          <ScrollView
            style={[styles.scrollView, { height: scrollViewHeight }]}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollViewPaddingBottom },
            ]}
            showsVerticalScrollIndicator={true}
          >
            {children}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
})
