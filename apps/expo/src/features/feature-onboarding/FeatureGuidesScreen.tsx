import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import { SafeAreaBox, usePageBottomInset } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import { replayFeatureOnboarding } from './featureOnboardingRequests'
import { ALL_ONBOARDING_IDS, getOnboardingTitle, type OnboardingId } from './onboardingConfig'

const ICONS: Record<OnboardingId, ComponentProps<typeof FeatherIcon>['name']> = {
  'verse-selection': 'type',
  'annotation-mode': 'pen-tool',
  'book-selector': 'book-open',
  tabs: 'layers',
  studies: 'feather',
  'bible-audio': 'headphones',
}

/** Every explanation of the app, to see one again at will. */
const FeatureGuidesScreen = () => {
  const { t } = useTranslation()
  const bottomInset = usePageBottomInset()

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-canvas">
      <Header hasBackButton title={t('featureGuides.title')} />
      <ScrollView
        backgroundColor="canvas"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 + bottomInset }}
      >
        <ListSection>
          {ALL_ONBOARDING_IDS.map(id => (
            <ListRow
              key={id}
              label={getOnboardingTitle(id, t)}
              icon={<FeatherIcon name={ICONS[id]} size={17} color="primary" />}
              iconTint="primary"
              onPress={() => replayFeatureOnboarding(id)}
              hasChevron={false}
            />
          ))}
        </ListSection>
      </ScrollView>
    </SafeAreaBox>
  )
}

export default FeatureGuidesScreen
