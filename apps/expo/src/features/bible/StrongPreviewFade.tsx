import type { ReactNode } from 'react'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'

export default function StrongPreviewFade({ children }: { children: ReactNode }) {
  return (
    <MaskedView
      style={{ height: 72 }}
      maskElement={
        <LinearGradient
          colors={['black', 'black', 'transparent']}
          locations={[0, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
      }
    >
      {children}
    </MaskedView>
  )
}
