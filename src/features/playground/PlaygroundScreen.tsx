import { useState } from 'react'
import PlaygroundHome from './PlaygroundHome'
import PlaygroundOnboarding from './PlaygroundOnboarding'

const PlaygroundScreen = () => {
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false)

  return isOnboardingVisible ? (
    <PlaygroundOnboarding onComplete={() => setIsOnboardingVisible(false)} />
  ) : (
    <PlaygroundHome onOpenAbelOnboarding={() => setIsOnboardingVisible(true)} />
  )
}

export default PlaygroundScreen
