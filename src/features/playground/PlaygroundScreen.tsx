import { useState } from 'react'
import SelectResources from '~features/onboarding/SelectResources'
import PlaygroundHome from './PlaygroundHome'
import PlaygroundOnboarding from './PlaygroundOnboarding'

type PlaygroundView = 'home' | 'abel-onboarding' | 'offline-setup'

const PlaygroundScreen = () => {
  const [view, setView] = useState<PlaygroundView>('home')

  if (view === 'abel-onboarding') {
    return <PlaygroundOnboarding onComplete={() => setView('home')} />
  }

  if (view === 'offline-setup') {
    return <SelectResources mode="preview" onClose={() => setView('home')} />
  }

  return (
    <PlaygroundHome
      onOpenAbelOnboarding={() => setView('abel-onboarding')}
      onOpenOfflineSetup={() => setView('offline-setup')}
    />
  )
}

export default PlaygroundScreen
