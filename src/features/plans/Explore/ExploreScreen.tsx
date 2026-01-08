import React, { useState } from 'react'
import { ScrollView, RefreshControl } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPlans } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { selectSortedOnlinePlans } from '~redux/selectors/plan'
import ExplorePlanItem from './ExplorePlanItem'
import Empty from '~common/Empty'
import { useTranslation } from 'react-i18next'
import i18n from '~i18n'
import Box from '~common/ui/Box'
import { LinkBox } from '~common/Link'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'

const LangButton = ({
  children,
  onPress,
  isSelected,
}: {
  children: React.ReactNode
  onPress: () => void
  isSelected: boolean
}) => (
  <LinkBox onPress={onPress}>
    <Box
      bg={isSelected ? 'primary' : 'reverse'}
      px={15}
      py={7}
      lightShadow
      borderRadius={20}
      my={10}
      mr={10}
    >
      <Text color={isSelected ? 'reverse' : 'grey'} textAlign="center">
        {children}
      </Text>
    </Box>
  </LinkBox>
)

const ExploreScreen = () => {
  const { t } = useTranslation()
  const currentLang = useLanguage()
  const dispatch = useDispatch()
  const [lang, setLang] = useState(currentLang)
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const plans = useSelector(selectSortedOnlinePlans)

  React.useEffect(() => {
    // @ts-ignore
    dispatch(fetchPlans())
  }, [dispatch])

  if (status === 'Rejected') {
    return (
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={false}
            // @ts-ignore
            onRefresh={() => dispatch(fetchPlans())}
          />
        }
      >
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Vous devez être enregistré pour accéder aux plans')}
        />
      </ScrollView>
    )
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={status === 'Pending'}
          // @ts-ignore
          onRefresh={() => dispatch(fetchPlans())}
        />
      }
      contentContainerStyle={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        maxWidth: 600,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      }}
    >
      <Box row width="100%" p={10}>
        <LangButton isSelected={lang === 'fr'} onPress={() => setLang('fr')}>
          Français
        </LangButton>
        <LangButton isSelected={lang === 'en'} onPress={() => setLang('en')}>
          English
        </LangButton>
      </Box>
      {plans
        .filter((p: any) => p.lang === lang)
        .map((plan: any) => (
          <ExplorePlanItem key={plan.id} {...plan} />
        ))}
    </ScrollView>
  )
}

ExploreScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Explorer'),
})

export default ExploreScreen
