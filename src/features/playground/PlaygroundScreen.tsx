import { useState } from 'react'
import PlaygroundHome from './PlaygroundHome'
import PlaygroundOnboarding from './PlaygroundOnboarding'

const PlaygroundScreen = () => {
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(true)

  return isOnboardingVisible ? (
    <PlaygroundOnboarding onComplete={() => setIsOnboardingVisible(false)} />
  ) : (
    <PlaygroundHome onReplay={() => setIsOnboardingVisible(true)} />
  )
}

export default PlaygroundScreen
