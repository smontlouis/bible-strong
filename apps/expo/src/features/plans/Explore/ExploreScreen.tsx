import { twMerge } from '~common/ui/classNames'

import { pageContentStyle } from '~common/ui/PageContent'
import React, { useState } from 'react'
import { ScrollView, RefreshControl } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { fetchPlans } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { selectSortedOnlinePlans } from '~redux/selectors/plan'
import type { AppDispatch } from '~redux/store'
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
}) => {
  return (
    <LinkBox onPress={onPress}>
      <Box
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge(
            isSelected ? 'bg-primary' : 'bg-reverse',
            'overflow-hidden border-continuous px-[15px] py-[7px] rounded-[20px] my-[10px] mr-[10px]'
          )
        )}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Text className={twMerge(isSelected ? 'text-reverse' : 'text-grey', 'text-center')}>
          {children}
        </Text>
      </Box>
    </LinkBox>
  )
}

const ExploreScreen = () => {
  const { t } = useTranslation()
  const currentLang = useLanguage()
  const dispatch = useDispatch<AppDispatch>()
  const [lang, setLang] = useState(currentLang)
  const status = useSelector((state: RootState) => state.plan.onlineStatus)
  const plans = useSelector(selectSortedOnlinePlans)

  React.useEffect(() => {
    dispatch(fetchPlans())
  }, [dispatch])

  if (status === 'Rejected') {
    return (
      <ScrollView
        contentContainerStyle={pageContentStyle}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => dispatch(fetchPlans())} />
        }
      >
        <Empty
          icon={require('~assets/images/empty-state-icons/plan.svg')}
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
          onRefresh={() => dispatch(fetchPlans())}
        />
      }
      contentContainerStyle={[
        pageContentStyle,
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%',
        },
      ]}
    >
      <Box className="overflow-hidden border-continuous flex-row w-[100%] p-[10px]">
        <LangButton isSelected={lang === 'fr'} onPress={() => setLang('fr')}>
          Français
        </LangButton>
        <LangButton isSelected={lang === 'en'} onPress={() => setLang('en')}>
          English
        </LangButton>
      </Box>
      {plans
        .filter(p => p.lang === lang)
        .map(plan => (
          <ExplorePlanItem key={plan.id} {...plan} />
        ))}
    </ScrollView>
  )
}

ExploreScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Explorer'),
})

export default ExploreScreen
